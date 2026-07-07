/**
 * Signing envelope service: build a draft envelope from a product template + admin
 * role bindings, and read envelopes as API DTOs. Provider send/finalize orchestration
 * is layered on top of this in later slices.
 */
import * as crypto from "crypto";
import {
  SIGNING_TEMPLATE_WORKFLOW_KEY,
  parseSigningTemplateConfig,
  validateSigningTemplateConfig,
  validateRecipientBindings,
  buildEnvelopePlanFromTemplate,
  rollupDocumentStatus,
  rollupRecipientStatus,
  rollupEnvelopeStatus,
  type AssignmentStatusInput,
  ApplicationStatus,
  ContractStatus,
  InvoiceStatus,
  type ExternalSigningSessionDto,
  type RecipientBinding,
  type SigningEnvelopeDto,
  type SigningTemplateConfig,
  signingRecipientEmailMatchesUser,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { sendEmail } from "../../lib/email/ses-client";
import { getS3ObjectBuffer, putS3ObjectBuffer } from "../../lib/s3/client";
import { ProductRepository } from "../products/repository";
import { OrganizationRepository } from "../organization/repository";
import { OrganizationService } from "../organization/service";
import { buildAdminPeopleList } from "../admin/build-people-list";
import { assertRequiredPostApplicationSupportingDocumentsPresent } from "../applications/supporting-docs-workflow";
import {
  generateContractOfferLetterBuffer,
  generateInvoiceOfferLetterBuffer,
  type OfferLetterSignatory,
} from "../applications/offer-letter-pdf";
import { applicationService } from "../applications/service";
import { requireCompletedSigningCloudEkycForOrganization } from "../ekyc/service";
import {
  signingRepository,
  type SigningApplicationContext,
  type SigningRepository,
} from "./repository";
import { mapSigningEnvelopeToDto, type SigningEnvelopeWithGraph } from "./mapper";
import { SigningCloudProvider } from "./provider/signingcloud-adapter";
import type { SigningProvider } from "./provider/adapter";

/** How long an external recipient's no-auth signing link stays valid. */
const EXTERNAL_ACCESS_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function buildExternalSigningUrl(accessToken: string): string | null {
  const issuerUrl = process.env.ISSUER_URL?.trim().replace(/\/$/, "");
  if (!issuerUrl) return null;
  return `${issuerUrl}/signing/external/${encodeURIComponent(accessToken)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface CreateDraftEnvelopeInput {
  applicationId: string;
  /** Raw product signing_template config (parsed defensively). */
  templateConfig: unknown;
  bindings: RecipientBinding[];
  title: string;
  contractId?: string | null;
  invoiceId?: string | null;
  productVersion?: number | null;
  createdByUserId?: string | null;
  expiresAt?: Date | null;
}

export interface CreateIssuerEnvelopeInput {
  applicationId: string;
  userId: string;
  bindings: RecipientBinding[];
  title?: string | null;
  contractId?: string | null;
  invoiceId?: string | null;
  expiresAt?: Date | null;
}

export class SigningService {
  constructor(
    private readonly repo: SigningRepository = signingRepository,
    private readonly provider: SigningProvider = new SigningCloudProvider(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly organizationRepository: OrganizationRepository = new OrganizationRepository(),
    private readonly organizationService: OrganizationService = new OrganizationService()
  ) {}

  private async requireApplicationContext(
    applicationId: string
  ): Promise<SigningApplicationContext> {
    const application = await this.repo.findApplicationContext(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found.");
    }
    return application;
  }

  private async assertIssuerApplicationAccess(
    application: SigningApplicationContext,
    userId: string
  ): Promise<void> {
    const organization = application.issuer_organization;
    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found for this application.");
    }
    if (organization.owner_user_id === userId) return;
    const member = await this.organizationRepository.getOrganizationMember(
      application.issuer_organization_id,
      userId,
      "issuer"
    );
    if (!member) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have access to this application."
      );
    }
  }

  private readSigningTemplateFromWorkflow(workflow: unknown): SigningTemplateConfig {
    const steps = Array.isArray(workflow) ? workflow : [];
    for (const step of steps) {
      const config = (step as { config?: Record<string, unknown> } | null)?.config;
      if (config && config[SIGNING_TEMPLATE_WORKFLOW_KEY] != null) {
        return parseSigningTemplateConfig(config[SIGNING_TEMPLATE_WORKFLOW_KEY]);
      }
    }
    return parseSigningTemplateConfig(null);
  }

  private async getProductWorkflowForApplication(
    application: SigningApplicationContext
  ): Promise<unknown[]> {
    const productId = (application.financing_type as { product_id?: string } | null | undefined)
      ?.product_id;
    if (!productId) {
      throw new AppError(400, "VALIDATION_ERROR", "Application has no product configured.");
    }
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new AppError(400, "VALIDATION_ERROR", "Product not found.");
    }
    return (product.workflow as unknown[]) ?? [];
  }

  private applicationHasOfferSent(application: SigningApplicationContext): boolean {
    const status = application.status as string;
    if (
      status === ApplicationStatus.CONTRACT_SENT ||
      status === ApplicationStatus.INVOICES_SENT ||
      status === ApplicationStatus.CONTRACT_ACCEPTED ||
      status === ApplicationStatus.APPROVED
    ) {
      return true;
    }
    if (application.contract?.status === ContractStatus.OFFER_SENT) return true;
    return application.invoices.some((invoice) => invoice.status === InvoiceStatus.OFFER_SENT);
  }

  private resolveEnvelopeTarget(input: {
    application: SigningApplicationContext;
    contractId?: string | null;
    invoiceId?: string | null;
  }): { contractId: string | null; invoiceId: string | null } {
    const { application, contractId, invoiceId } = input;
    if (contractId && invoiceId) {
      throw new AppError(400, "VALIDATION_ERROR", "Choose either a contract or invoice offer, not both.");
    }
    if (contractId) {
      if (application.contract_id !== contractId || application.contract?.status !== ContractStatus.OFFER_SENT) {
        throw new AppError(400, "INVALID_STATE", "Contract offer is not available for signing.");
      }
      return { contractId, invoiceId: null };
    }
    if (invoiceId) {
      const invoice = application.invoices.find((item) => item.id === invoiceId);
      if (!invoice || invoice.status !== InvoiceStatus.OFFER_SENT) {
        throw new AppError(400, "INVALID_STATE", "Invoice offer is not available for signing.");
      }
      return { contractId: null, invoiceId };
    }
    if (application.contract?.status === ContractStatus.OFFER_SENT) {
      return { contractId: application.contract.id, invoiceId: null };
    }
    const invoice = application.invoices.find((item) => item.status === InvoiceStatus.OFFER_SENT);
    if (invoice) return { contractId: null, invoiceId: invoice.id };
    throw new AppError(400, "INVALID_STATE", "No pending offer is available for signing.");
  }

  private async validateAndNormalizeIssuerBindings(
    application: SigningApplicationContext,
    template: SigningTemplateConfig,
    bindings: RecipientBinding[]
  ): Promise<RecipientBinding[]> {
    const extras = await this.organizationService.getIssuerPartyListExtras(
      application.issuer_organization_id
    );
    const people = buildAdminPeopleList({
      ctos: extras.latestOrganizationCtosCompanyJson ?? null,
      issuerDirectorKycStatus: application.issuer_organization.director_kyc_status ?? null,
      issuerDirectorAmlStatus: application.issuer_organization.director_aml_status ?? null,
      ctosPartySupplements: extras.ctosPartySupplements.map((row) => ({
        party_key: row.partyKey,
        onboarding_json: row.onboardingJson,
      })),
      corporateEntities: application.issuer_organization.corporate_entities ?? null,
    });
    const directorEmails = new Set(
      people
        .filter((person) => person.roles.some((role) => role.toUpperCase() === "DIRECTOR"))
        .map((person) => String(person.email ?? "").trim().toLowerCase())
        .filter(Boolean)
    );
    const roleByKey = new Map(template.roles.map((role) => [role.key, role]));
    const applicationGuarantorIds = new Set(application.application_guarantors.map((g) => g.id));
    const normalized: RecipientBinding[] = [];
    for (const binding of bindings) {
      const role = roleByKey.get(binding.role_key);
      if (!role) {
        normalized.push(binding);
        continue;
      }
      if (role.source_hint === "issuer_director") {
        const email = binding.email.trim().toLowerCase();
        if (!directorEmails.has(email)) {
          throw new AppError(
            400,
            "SIGNING_BINDINGS_INVALID",
            `Recipient for "${role.label || role.key}" must be one of the application's directors.`
          );
        }
      }
      if (
        binding.application_guarantor_id &&
        !applicationGuarantorIds.has(binding.application_guarantor_id)
      ) {
        throw new AppError(
          400,
          "SIGNING_BINDINGS_INVALID",
          "Selected guarantor does not belong to this application."
        );
      }
      if (
        role.source_hint === "guarantor" &&
        role.party_type === "EXTERNAL" &&
        !String(binding.ic_number ?? "").trim()
      ) {
        throw new AppError(
          400,
          "SIGNING_BINDINGS_INVALID",
          `Recipient for "${role.label || role.key}" must include an IC number.`
        );
      }
      normalized.push({
        ...binding,
        user_id: null,
        application_guarantor_id: binding.application_guarantor_id ?? null,
        ic_number: binding.ic_number?.trim() || null,
      });
    }
    return normalized;
  }

  private async assertPostApplicationDocumentsReady(
    application: SigningApplicationContext
  ): Promise<void> {
    const workflow = await this.getProductWorkflowForApplication(application);
    assertRequiredPostApplicationSupportingDocumentsPresent(
      workflow,
      application.supporting_documents
    );
  }

  async createDraftEnvelope(input: CreateDraftEnvelopeInput): Promise<SigningEnvelopeDto> {
    const template = parseSigningTemplateConfig(input.templateConfig);
    if (!template.enabled) {
      throw new AppError(400, "SIGNING_TEMPLATE_DISABLED", "This product has no signing package configured.");
    }

    const templateErrors = validateSigningTemplateConfig(template);
    if (templateErrors.length > 0) {
      throw new AppError(400, "SIGNING_TEMPLATE_INVALID", templateErrors[0], templateErrors);
    }

    const bindingErrors = validateRecipientBindings(template, input.bindings);
    if (bindingErrors.length > 0) {
      throw new AppError(400, "SIGNING_BINDINGS_INVALID", bindingErrors[0], bindingErrors);
    }

    const plan = buildEnvelopePlanFromTemplate(template, input.bindings);
    const envelope = await this.repo.createFromPlan({
      application_id: input.applicationId,
      contract_id: input.contractId ?? null,
      invoice_id: input.invoiceId ?? null,
      product_version: input.productVersion ?? null,
      title: input.title,
      created_by_user_id: input.createdByUserId ?? null,
      expires_at: input.expiresAt ?? null,
      plan,
    });
    return mapSigningEnvelopeToDto(envelope);
  }

  async createIssuerEnvelope(input: CreateIssuerEnvelopeInput): Promise<SigningEnvelopeDto> {
    const application = await this.requireApplicationContext(input.applicationId);
    await this.assertIssuerApplicationAccess(application, input.userId);
    if (!this.applicationHasOfferSent(application)) {
      throw new AppError(400, "INVALID_STATE", "An offer must be sent before creating a signing package.");
    }
    const activeEnvelope = await this.repo.findActiveEnvelopeForApplication(input.applicationId);
    if (activeEnvelope) {
      throw new AppError(409, "SIGNING_ENVELOPE_EXISTS", "This application already has an active signing package.");
    }
    const workflow = await this.getProductWorkflowForApplication(application);
    const template = this.readSigningTemplateFromWorkflow(workflow);
    const { contractId, invoiceId } = this.resolveEnvelopeTarget({
      application,
      contractId: input.contractId,
      invoiceId: input.invoiceId,
    });
    const bindings = await this.validateAndNormalizeIssuerBindings(
      application,
      template,
      input.bindings
    );
    return this.createDraftEnvelope({
      applicationId: input.applicationId,
      title: input.title?.trim() || "Signing package",
      contractId,
      invoiceId,
      productVersion: application.product_version ?? null,
      templateConfig: template,
      bindings,
      createdByUserId: input.userId,
      expiresAt: input.expiresAt ?? null,
    });
  }

  async getEnvelope(id: string): Promise<SigningEnvelopeDto> {
    return mapSigningEnvelopeToDto(await this.requireEnvelope(id));
  }

  async listEnvelopesForApplication(applicationId: string): Promise<SigningEnvelopeDto[]> {
    const envelopes = await this.repo.findByApplicationId(applicationId);
    return envelopes.map(mapSigningEnvelopeToDto);
  }

  async getEnvelopeForIssuer(id: string, userId: string): Promise<SigningEnvelopeDto> {
    const envelope = await this.requireEnvelope(id);
    const application = await this.requireApplicationContext(envelope.application_id);
    await this.assertIssuerApplicationAccess(application, userId);
    return mapSigningEnvelopeToDto(envelope);
  }

  async listEnvelopesForApplicationForIssuer(
    applicationId: string,
    userId: string
  ): Promise<SigningEnvelopeDto[]> {
    const application = await this.requireApplicationContext(applicationId);
    await this.assertIssuerApplicationAccess(application, userId);
    return this.listEnvelopesForApplication(applicationId);
  }

  private async requireExternalTokenSession(accessToken: string): Promise<{
    envelope: SigningEnvelopeWithGraph;
    recipientId: string;
  }> {
    const resolved = await this.repo.findEnvelopeByRecipientAccessToken(accessToken);
    if (!resolved) {
      throw new AppError(404, "SIGNING_LINK_NOT_FOUND", "Signing link not found.");
    }
    const recipient = resolved.envelope.recipients.find((item) => item.id === resolved.recipientId);
    if (!recipient || recipient.party_type !== "EXTERNAL") {
      throw new AppError(403, "SIGNING_LINK_INVALID", "Signing link is not valid for this recipient.");
    }
    if (
      recipient.access_token_expires_at &&
      recipient.access_token_expires_at.getTime() < Date.now()
    ) {
      throw new AppError(410, "SIGNING_LINK_EXPIRED", "This signing link has expired.");
    }
    if (["VOIDED", "DECLINED", "EXPIRED", "COMPLETED"].includes(resolved.envelope.status)) {
      throw new AppError(409, "SIGNING_ENVELOPE_CLOSED", "This signing package is closed.");
    }
    return resolved;
  }

  async getEnvelopeForExternalToken(accessToken: string): Promise<ExternalSigningSessionDto> {
    const { envelope, recipientId } = await this.requireExternalTokenSession(accessToken);
    return { envelope: mapSigningEnvelopeToDto(envelope), recipient_id: recipientId };
  }

  private async requireEnvelope(id: string): Promise<SigningEnvelopeWithGraph> {
    const envelope = await this.repo.findById(id);
    if (!envelope) {
      throw new AppError(404, "SIGNING_ENVELOPE_NOT_FOUND", "Signing envelope not found.");
    }
    return envelope;
  }

  /**
   * Send a draft envelope: register one provider contract per document (with all its
   * signers), issue no-auth access tokens for external recipients, and flip the envelope
   * to SENT. Every document must already have its unsigned PDF materialised in S3.
   */
  async sendEnvelope(id: string): Promise<SigningEnvelopeDto> {
    const envelope = await this.requireEnvelope(id);
    if (envelope.status !== "DRAFT") {
      throw new AppError(409, "SIGNING_ENVELOPE_NOT_DRAFT", "Only draft envelopes can be sent.");
    }

    const recipientById = new Map(envelope.recipients.map((r) => [r.id, r]));
    const application = await this.requireApplicationContext(envelope.application_id);

    for (const document of [...envelope.documents].sort((a, b) => a.order - b.order)) {
      const docAssignments = envelope.assignments.filter((a) => a.document_id === document.id);
      if (docAssignments.length === 0) continue;

      let signsetsByAssignmentId = new Map<string, unknown>();
      let unsignedS3Key = document.unsigned_s3_key;

      if (document.source === "GENERATED_OFFER_LETTER") {
        const materialized = await this.materializeGeneratedOfferLetter(
          envelope,
          document.id,
          application,
          docAssignments,
          recipientById
        );
        unsignedS3Key = materialized.s3Key;
        signsetsByAssignmentId = materialized.signsetsByAssignmentId;
      } else {
        throw new AppError(
          422,
          "SIGNING_DOCUMENT_NOT_SUPPORTED",
          `Document "${document.name}" is not supported yet. Use a generated offer letter template.`
        );
      }

      if (!unsignedS3Key) {
        throw new AppError(
          422,
          "SIGNING_DOCUMENT_NOT_READY",
          `Document "${document.name}" has no file to sign.`
        );
      }

      const pdfBuffer = await getS3ObjectBuffer(unsignedS3Key);
      const orderedAssignments = this.orderDocumentAssignments(docAssignments, recipientById);
      const signers = orderedAssignments.map(({ assignment, recipient }) => ({
        email: recipient.email,
        signset:
          signsetsByAssignmentId.get(assignment.id) ??
          assignment.signset ??
          undefined,
      }));

      const { providerRef } = await this.provider.createDocumentContract({
        pdfBuffer,
        contractName: `${envelope.title} — ${document.name}`,
        signers,
      });
      await this.repo.markDocumentSent(document.id, providerRef);
    }

    // No-auth links for external recipients (emailed in Phase 3).
    const expiresAt = new Date(Date.now() + EXTERNAL_ACCESS_TOKEN_TTL_MS);
    for (const recipient of envelope.recipients) {
      if (recipient.party_type === "EXTERNAL" && !recipient.access_token) {
        const accessToken = crypto.randomBytes(32).toString("hex");
        await this.repo.setRecipientAccessToken(
          recipient.id,
          accessToken,
          expiresAt
        );
        await this.sendExternalSigningEmail({
          envelope,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          accessToken,
          isReminder: false,
        });
      }
    }

    await this.repo.markEnvelopeSent(id);
    return this.getEnvelope(id);
  }

  private orderDocumentAssignments(
    docAssignments: SigningEnvelopeWithGraph["assignments"],
    recipientById: Map<string, SigningEnvelopeWithGraph["recipients"][number]>
  ): Array<{
    assignment: SigningEnvelopeWithGraph["assignments"][number];
    recipient: SigningEnvelopeWithGraph["recipients"][number];
  }> {
    return docAssignments
      .map((assignment) => {
        const recipient = recipientById.get(assignment.recipient_id);
        return recipient ? { assignment, recipient } : null;
      })
      .filter(
        (
          row
        ): row is {
          assignment: SigningEnvelopeWithGraph["assignments"][number];
          recipient: SigningEnvelopeWithGraph["recipients"][number];
        } => row != null
      )
      .sort((a, b) => {
        const orderDiff = a.recipient.routing_order - b.recipient.routing_order;
        if (orderDiff !== 0) return orderDiff;
        return a.recipient.name.localeCompare(b.recipient.name);
      });
  }

  private resolveOfferLetterSignatories(
    docAssignments: SigningEnvelopeWithGraph["assignments"],
    recipientById: Map<string, SigningEnvelopeWithGraph["recipients"][number]>
  ): OfferLetterSignatory[] {
    return this.orderDocumentAssignments(docAssignments, recipientById).map(({ recipient }) => ({
      name: recipient.name,
      email: recipient.email,
    }));
  }

  private async materializeGeneratedOfferLetter(
    envelope: SigningEnvelopeWithGraph,
    documentId: string,
    application: SigningApplicationContext,
    docAssignments: SigningEnvelopeWithGraph["assignments"],
    recipientById: Map<string, SigningEnvelopeWithGraph["recipients"][number]>
  ): Promise<{ s3Key: string; signsetsByAssignmentId: Map<string, unknown> }> {
    const signatories = this.resolveOfferLetterSignatories(docAssignments, recipientById);
    if (signatories.length === 0) {
      throw new AppError(
        422,
        "SIGNING_DOCUMENT_NOT_READY",
        "Generated offer letter requires at least one signer."
      );
    }

    const orderedAssignments = this.orderDocumentAssignments(docAssignments, recipientById);
    let generated: Awaited<ReturnType<typeof generateContractOfferLetterBuffer>>;

    if (envelope.invoice_id) {
      const invoice = application.invoices.find((item) => item.id === envelope.invoice_id);
      if (!invoice?.offer_details || typeof invoice.offer_details !== "object") {
        throw new AppError(400, "INVALID_STATE", "Invoice offer details are not available.");
      }
      generated = await generateInvoiceOfferLetterBuffer(
        invoice.id,
        invoice.offer_details as Record<string, unknown>,
        signatories
      );
    } else if (envelope.contract_id) {
      const contract = application.contract;
      if (
        !contract ||
        contract.id !== envelope.contract_id ||
        !contract.offer_details ||
        typeof contract.offer_details !== "object"
      ) {
        throw new AppError(400, "INVALID_STATE", "Contract offer details are not available.");
      }
      generated = await generateContractOfferLetterBuffer(
        contract.id,
        contract.offer_details as Record<string, unknown>,
        signatories
      );
    } else {
      throw new AppError(400, "INVALID_STATE", "Generated offer letter needs a contract or invoice target.");
    }

    if (generated.signsets.length !== orderedAssignments.length) {
      throw new AppError(
        500,
        "SIGNING_LAYOUT_ERROR",
        "Offer letter signature layout does not match signer count."
      );
    }

    const signsetsByAssignmentId = new Map<string, unknown>();
    for (let index = 0; index < orderedAssignments.length; index += 1) {
      const signset = generated.signsets[index];
      const { assignment } = orderedAssignments[index];
      signsetsByAssignmentId.set(assignment.id, signset);
      await this.repo.setAssignmentSignset(assignment.id, signset);
    }

    const s3Key = `applications/${envelope.application_id}/signing/${envelope.id}/unsigned/${documentId}.pdf`;
    await putS3ObjectBuffer({ key: s3Key, body: generated.pdfBuffer, contentType: "application/pdf" });
    await this.repo.setDocumentUnsignedS3Key(documentId, s3Key);
    return { s3Key, signsetsByAssignmentId };
  }

  async sendEnvelopeForIssuer(id: string, userId: string): Promise<SigningEnvelopeDto> {
    const envelope = await this.requireEnvelope(id);
    const application = await this.requireApplicationContext(envelope.application_id);
    await this.assertIssuerApplicationAccess(application, userId);
    await this.assertPostApplicationDocumentsReady(application);
    return this.sendEnvelope(id);
  }

  /**
   * Hosted signing URL for one recipient's part of one document. Callers must have
   * already authorised the recipient (issuer session or valid external access token).
   */
  async startRecipientSigning(input: {
    envelopeId: string;
    recipientId: string;
    documentId: string;
    redirectUrl?: string | null;
    callbackUrl?: string | null;
  }): Promise<{ signingUrl: string }> {
    const envelope = await this.requireEnvelope(input.envelopeId);
    const document = envelope.documents.find((d) => d.id === input.documentId);
    const recipient = envelope.recipients.find((r) => r.id === input.recipientId);
    if (!document || !recipient) {
      throw new AppError(404, "SIGNING_ASSIGNMENT_NOT_FOUND", "Document or recipient not found.");
    }
    const assignment = envelope.assignments.find(
      (item) =>
        item.document_id === document.id &&
        item.recipient_id === recipient.id &&
        item.action === "SIGN"
    );
    if (!assignment) {
      throw new AppError(404, "SIGNING_ASSIGNMENT_NOT_FOUND", "This recipient does not sign this document.");
    }
    if (assignment.status === "SIGNED") {
      throw new AppError(409, "SIGNING_ASSIGNMENT_COMPLETE", "This signing step is already complete.");
    }
    if (!document.provider_contract_ref) {
      throw new AppError(409, "SIGNING_DOCUMENT_NOT_SENT", "This document has not been sent yet.");
    }
    return this.provider.startSignerSession({
      providerRef: document.provider_contract_ref,
      signerEmail: recipient.email,
      redirectUrl: input.redirectUrl ?? null,
      callbackUrl: input.callbackUrl ?? null,
    });
  }

  async startRecipientSigningForIssuer(input: {
    envelopeId: string;
    recipientId: string;
    documentId: string;
    userId: string;
    redirectUrl?: string | null;
    callbackUrl?: string | null;
  }): Promise<{ signingUrl: string }> {
    const envelope = await this.requireEnvelope(input.envelopeId);
    const application = await this.requireApplicationContext(envelope.application_id);
    await this.assertIssuerApplicationAccess(application, input.userId);
    await this.assertPostApplicationDocumentsReady(application);
    const { workEmail } = await requireCompletedSigningCloudEkycForOrganization(
      input.userId,
      application.issuer_organization_id
    );
    const recipient = envelope.recipients.find((item) => item.id === input.recipientId);
    if (recipient?.party_type === "EXTERNAL") {
      throw new AppError(
        403,
        "EXTERNAL_SIGNER_TOKEN_REQUIRED",
        "External recipients must use their secure signing link."
      );
    }
    if (!recipient || !signingRecipientEmailMatchesUser(recipient.email, workEmail)) {
      throw new AppError(
        403,
        "SIGNING_RECIPIENT_MISMATCH",
        "This signer slot does not match your verified identity email for this organization."
      );
    }
    return this.startRecipientSigning(input);
  }

  async startRecipientSigningForExternalToken(input: {
    accessToken: string;
    documentId: string;
    redirectUrl?: string | null;
    callbackUrl?: string | null;
  }): Promise<{ signingUrl: string }> {
    const { envelope, recipientId } = await this.requireExternalTokenSession(input.accessToken);
    return this.startRecipientSigning({
      envelopeId: envelope.id,
      recipientId,
      documentId: input.documentId,
      redirectUrl: input.redirectUrl ?? null,
      callbackUrl: input.callbackUrl ?? null,
    });
  }

  /**
   * Provider callback: a document's contract completed (all its signers signed).
   * Marks its assignments signed, stores the signed PDF, and rolls the whole graph up.
   * Idempotent — safe to call from both the webhook and a return-url fallback.
   */
  async applyProviderContractSigned(providerContractRef: string): Promise<{ skipped: boolean }> {
    const envelope = await this.repo.findByDocumentProviderRef(providerContractRef);
    if (!envelope) return { skipped: true };
    const document = envelope.documents.find(
      (d) => d.provider_contract_ref === providerContractRef
    );
    if (!document) return { skipped: true };
    if (document.status === "COMPLETED") return { skipped: true };

    if (!document.signed_s3_key) {
      const { pdfBuffer, sha256 } = await this.provider.fetchSignedDocument({
        providerRef: providerContractRef,
      });
      const s3Key = `applications/${envelope.application_id}/signing/${envelope.id}/${document.id}.pdf`;
      await putS3ObjectBuffer({ key: s3Key, body: pdfBuffer, contentType: "application/pdf" });
      await this.repo.recordSignedDocument(document.id, s3Key, sha256, "COMPLETED");
    } else {
      await this.repo.updateDocumentStatus(document.id, "COMPLETED");
    }

    for (const assignment of envelope.assignments) {
      if (assignment.document_id === document.id && assignment.status !== "SIGNED") {
        await this.repo.markAssignmentSigned(assignment.id);
      }
    }

    await this.rollupEnvelope(envelope.id);
    logger.info(
      { envelopeId: envelope.id, documentId: document.id },
      "Signing document completed via provider callback"
    );
    return { skipped: false };
  }

  /** Recompute recipient / envelope statuses from the current assignment matrix. */
  private async rollupEnvelope(envelopeId: string): Promise<void> {
    const envelope = await this.requireEnvelope(envelopeId);
    const assignmentInputs: AssignmentStatusInput[] = envelope.assignments.map((a) => ({
      status: a.status,
      required: a.required,
    }));

    for (const recipient of envelope.recipients) {
      const statuses = envelope.assignments
        .filter((a) => a.recipient_id === recipient.id)
        .map((a) => a.status);
      const next = rollupRecipientStatus(statuses);
      if (next !== recipient.status) {
        await this.repo.updateRecipientStatus(recipient.id, next, next === "SIGNED");
      }
    }

    for (const document of envelope.documents) {
      const docAssignments = envelope.assignments
        .filter((a) => a.document_id === document.id)
        .map((a) => ({ status: a.status, required: a.required }));
      const next = rollupDocumentStatus(docAssignments);
      if (next !== document.status && document.status !== "VOIDED") {
        await this.repo.updateDocumentStatus(document.id, next);
      }
    }

    const nextEnvelopeStatus = rollupEnvelopeStatus(assignmentInputs);
    if (nextEnvelopeStatus !== envelope.status) {
      await this.repo.updateEnvelopeStatus(
        envelopeId,
        nextEnvelopeStatus,
        nextEnvelopeStatus === "COMPLETED"
      );
      if (nextEnvelopeStatus === "COMPLETED") {
        await this.finalizeCompletedEnvelopeOffer(envelope);
      }
    }
  }

  private async finalizeCompletedEnvelopeOffer(envelope: SigningEnvelopeWithGraph): Promise<void> {
    const initiatedByUserId = envelope.created_by_user_id;
    if (!initiatedByUserId) {
      logger.warn({ envelopeId: envelope.id }, "Skipping offer finalization for envelope without creator");
      return;
    }
    const signedDocument =
      envelope.documents.find((document) => document.source === "GENERATED_OFFER_LETTER" && document.signed_s3_key) ??
      envelope.documents.find((document) => document.signed_s3_key);
    if (!signedDocument?.signed_s3_key || !signedDocument.signed_file_sha256) {
      logger.warn({ envelopeId: envelope.id }, "Skipping offer finalization because no signed document is available");
      return;
    }

    const result = await applicationService.finalizeOfferAfterEnvelopeCompletion({
      applicationId: envelope.application_id,
      contractId: envelope.contract_id,
      invoiceId: envelope.invoice_id,
      initiatedByUserId,
      signedOfferLetterS3Key: signedDocument.signed_s3_key,
      signedFileSha256: signedDocument.signed_file_sha256,
    });
    logger.info(
      { envelopeId: envelope.id, skipped: result.skipped },
      "Processed offer finalization after signing envelope completion"
    );
  }

  async voidEnvelope(id: string, reason: string | null): Promise<SigningEnvelopeDto> {
    const envelope = await this.requireEnvelope(id);
    if (envelope.status === "COMPLETED" || envelope.status === "VOIDED") {
      throw new AppError(409, "SIGNING_ENVELOPE_NOT_VOIDABLE", "This envelope can no longer be voided.");
    }
    await this.repo.voidEnvelope(id, reason);
    return this.getEnvelope(id);
  }

  async remindRecipient(envelopeId: string, recipientId: string): Promise<void> {
    const envelope = await this.requireEnvelope(envelopeId);
    const recipient = envelope.recipients.find((r) => r.id === recipientId);
    if (!recipient) {
      throw new AppError(404, "SIGNING_RECIPIENT_NOT_FOUND", "Recipient not found.");
    }
    if (recipient.party_type === "EXTERNAL") {
      const accessToken = recipient.access_token ?? crypto.randomBytes(32).toString("hex");
      if (!recipient.access_token) {
        await this.repo.setRecipientAccessToken(
          recipient.id,
          accessToken,
          new Date(Date.now() + EXTERNAL_ACCESS_TOKEN_TTL_MS)
        );
      }
      await this.sendExternalSigningEmail({
        envelope,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        accessToken,
        isReminder: true,
      });
    }
    await this.repo.touchRecipientReminder(recipientId);
  }

  private async sendExternalSigningEmail(input: {
    envelope: SigningEnvelopeWithGraph;
    recipientEmail: string;
    recipientName: string;
    accessToken: string;
    isReminder: boolean;
  }): Promise<void> {
    const signingUrl = buildExternalSigningUrl(input.accessToken);
    if (!signingUrl) {
      logger.warn(
        { envelopeId: input.envelope.id, recipientEmail: input.recipientEmail },
        "Skipping external signing email because ISSUER_URL is not configured"
      );
      return;
    }

    try {
      const title = input.envelope.title || "CashSouk signing package";
      const safeTitle = escapeHtml(title);
      const safeName = escapeHtml(input.recipientName || "there");
      await sendEmail({
        to: input.recipientEmail,
        subject: input.isReminder ? `Reminder: ${title}` : `Signature requested: ${title}`,
        html: `
          <p>Hi ${safeName},</p>
          <p>You have been asked to sign <strong>${safeTitle}</strong>.</p>
          <p><a href="${signingUrl}">Open secure signing link</a></p>
          <p>This link is unique to you. Do not forward it.</p>
        `,
        text: `Hi ${input.recipientName || "there"},\n\nYou have been asked to sign ${title}.\n\nOpen your secure signing link: ${signingUrl}\n\nThis link is unique to you. Do not forward it.`,
      });
    } catch (error) {
      logger.error(
        { error, envelopeId: input.envelope.id, recipientEmail: input.recipientEmail },
        "Failed to send external signing email"
      );
    }
  }
}

export const signingService = new SigningService();
