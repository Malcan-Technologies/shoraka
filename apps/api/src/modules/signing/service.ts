/**
 * Signing envelope service: build a draft envelope from a product template + admin
 * role bindings, and read envelopes as API DTOs. Provider send/finalize orchestration
 * is layered on top of this in later slices.
 */
import * as crypto from "crypto";
import {
  parseSigningTemplateConfig,
  validateSigningTemplateConfig,
  validateRecipientBindings,
  buildEnvelopePlanFromTemplate,
  rollupDocumentStatus,
  rollupRecipientStatus,
  rollupEnvelopeStatus,
  type AssignmentStatusInput,
  type RecipientBinding,
  type SigningEnvelopeDto,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { getS3ObjectBuffer, putS3ObjectBuffer } from "../../lib/s3/client";
import { signingRepository, type SigningRepository } from "./repository";
import { mapSigningEnvelopeToDto, type SigningEnvelopeWithGraph } from "./mapper";
import { SigningCloudProvider } from "./provider/signingcloud-adapter";
import type { SigningProvider } from "./provider/adapter";

/** How long an external recipient's no-auth signing link stays valid. */
const EXTERNAL_ACCESS_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

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

export class SigningService {
  constructor(
    private readonly repo: SigningRepository = signingRepository,
    private readonly provider: SigningProvider = new SigningCloudProvider()
  ) {}

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

  async getEnvelope(id: string): Promise<SigningEnvelopeDto> {
    return mapSigningEnvelopeToDto(await this.requireEnvelope(id));
  }

  async listEnvelopesForApplication(applicationId: string): Promise<SigningEnvelopeDto[]> {
    const envelopes = await this.repo.findByApplicationId(applicationId);
    return envelopes.map(mapSigningEnvelopeToDto);
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

    for (const document of [...envelope.documents].sort((a, b) => a.order - b.order)) {
      const docAssignments = envelope.assignments.filter((a) => a.document_id === document.id);
      if (docAssignments.length === 0) continue;
      if (!document.unsigned_s3_key) {
        throw new AppError(
          422,
          "SIGNING_DOCUMENT_NOT_READY",
          `Document "${document.name}" has no file to sign. Upload or generate it before sending.`
        );
      }

      const pdfBuffer = await getS3ObjectBuffer(document.unsigned_s3_key);
      const signers = docAssignments
        .map((a) => recipientById.get(a.recipient_id))
        .filter((r): r is NonNullable<typeof r> => Boolean(r))
        .sort((a, b) => a.routing_order - b.routing_order)
        .map((r) => ({ email: r.email }));

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
        await this.repo.setRecipientAccessToken(
          recipient.id,
          crypto.randomBytes(32).toString("hex"),
          expiresAt
        );
      }
    }

    await this.repo.markEnvelopeSent(id);
    return this.getEnvelope(id);
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
    }
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
    await this.repo.touchRecipientReminder(recipientId);
  }
}

export const signingService = new SigningService();
