import crypto from "crypto";
import {
  getGeneratedDocumentType,
  getLoAuthorizedPartiesFromAcceptance,
  getOfferAcceptanceFromOfferDetails,
  listGeneratedDocumentTypes,
  listGeneratedDocumentTypesForContext,
  parseGeneratedDocumentTypeKey,
  readFinancingStructureType,
  isInheritedFacilityGuarantorReview,
  resolveAcceptanceDocumentsFromWorkflow,
  parseSupportingDocumentRow,
  parseGuarantorAgreementRow,
  getStepKeyFromStepId,
  resolveSigningTemplateFromWorkflow,
  SIGNING_PACKAGE_GENERATED_DOCUMENT_TYPES,
  type GeneratedDocumentContext,
  type GeneratedDocumentTypeDefinition,
  type GeneratedDocumentTypeKey,
  type GeneratedDocumentRequires,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { ApplicationRepository } from "../applications/repository";
import { ProductRepository } from "../products/repository";
import { OrganizationRepository } from "../organization/repository";
import { buildFacilityLoMergeData } from "../applications/letter-of-offer/build-facility-lo-merge-data";
import { assertFacilityLoMergeReady } from "../applications/letter-of-offer/assert-facility-lo-ready";
import {
  readFacilityLoTemplateBytes,
  renderFacilityLoDocx,
} from "../applications/letter-of-offer/render-facility-lo-docx";
import { buildJsgMergeData } from "../applications/joint-several-guarantee/build-jsg-merge-data";
import { assertJsgMergeReady } from "../applications/joint-several-guarantee/assert-jsg-ready";
import {
  readJsgTemplateBytes,
  renderJsgDocx,
} from "../applications/joint-several-guarantee/render-jsg-docx";
import { buildDeedOfAssignmentMergeData } from "../applications/deed-of-assignment/build-doa-merge-data";
import { assertDeedOfAssignmentMergeReady } from "../applications/deed-of-assignment/assert-doa-ready";
import {
  readDeedOfAssignmentTemplateBytes,
  renderDeedOfAssignmentDocx,
} from "../applications/deed-of-assignment/render-doa-docx";
import { convertDocxToPdf, DocxToPdfError } from "../applications/letter-of-offer/convert-docx-to-pdf";
import { loadInheritedGuarantorsForExistingContract } from "../../lib/contract-originating-application";
import { buildFacilityAgreementMergeData } from "../applications/facility-agreement/build-fa-merge-data";
import { assertFacilityAgreementMergeReady } from "../applications/facility-agreement/assert-fa-ready";
import {
  readFacilityAgreementTemplateBytes,
  renderFacilityAgreementDocx,
} from "../applications/facility-agreement/render-fa-docx";

const SUPPORTING_DOC_CATEGORIES = [
  "financial_docs",
  "legal_docs",
  "compliance_docs",
  "others",
] as const;

export type GeneratedDocumentFormat = "pdf" | "docx";

export type GeneratedDocumentResult = {
  buffer: Buffer;
  contentType: string;
  filename: string;
  templateSha256: string;
  outputSha256: string;
  type: GeneratedDocumentTypeDefinition;
};

function findStepConfig(workflow: unknown[], stepKey: string): Record<string, unknown> | null {
  if (!Array.isArray(workflow)) return null;
  for (const step of workflow) {
    const sid = String((step as { id?: unknown })?.id ?? "");
    if (getStepKeyFromStepId(sid) !== stepKey) continue;
    const config = (step as { config?: unknown }).config;
    return config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : null;
  }
  return null;
}

export function workflowDeclaresGeneratedDocumentType(
  workflow: unknown[],
  typeKey: GeneratedDocumentTypeKey
): boolean {
  const typeDef = getGeneratedDocumentType(typeKey);
  if (!typeDef) return false;

  if (typeDef.allowedContexts.includes("acceptance_documents")) {
    const rows = resolveAcceptanceDocumentsFromWorkflow(workflow);
    if (rows.some((row) => row.generated_document_type === typeKey)) return true;
  }

  if (typeDef.allowedContexts.includes("supporting_documents")) {
    const config = findStepConfig(workflow, "supporting_documents");
    if (config) {
      for (const category of SUPPORTING_DOC_CATEGORIES) {
        const list = config[category];
        if (!Array.isArray(list)) continue;
        for (const raw of list) {
          if (parseSupportingDocumentRow(raw).generated_document_type === typeKey) return true;
        }
      }
    }
  }

  if (typeDef.allowedContexts.includes("guarantor_agreement")) {
    const config = findStepConfig(workflow, "business_details");
    if (config) {
      const raw = config.guarantor_agreement ?? config.guarantor_agreement_template;
      if (raw && typeof raw === "object") {
        if (parseGuarantorAgreementRow(raw).generated_document_type === typeKey) return true;
      }
    }
  }

  if (typeDef.allowedContexts.includes("signing_packages")) {
    const template = resolveSigningTemplateFromWorkflow(workflow);
    if (
      template.documents.some(
        (document) => SIGNING_PACKAGE_GENERATED_DOCUMENT_TYPES[document.key] === typeKey
      )
    ) {
      return true;
    }
  }

  return false;
}

function offerDetailsPresent(offer: unknown): boolean {
  return offer != null && typeof offer === "object" && !Array.isArray(offer);
}

function contractOfferDetailsPresent(application: {
  contract?: { offer_details?: unknown } | null;
}): boolean {
  return offerDetailsPresent(application.contract?.offer_details);
}

function invoiceOfferDetailsPresent(application: {
  invoices?: Array<{ offer_details?: unknown }> | null;
}): boolean {
  return (application.invoices ?? []).some((invoice) => offerDetailsPresent(invoice.offer_details));
}

function assertRequiresMet(
  requires: GeneratedDocumentRequires[],
  application: {
    contract?: { offer_details?: unknown } | null;
    invoices?: Array<{ offer_details?: unknown }> | null;
  }
): void {
  for (const requirement of requires) {
    if (requirement === "contract_offer_sent") {
      if (!contractOfferDetailsPresent(application)) {
        throw new AppError(
          400,
          "GENERATED_DOCUMENT_REQUIRES_NOT_MET",
          "Contract offer has not been sent yet."
        );
      }
    }
    if (requirement === "offer_sent") {
      if (!contractOfferDetailsPresent(application) && !invoiceOfferDetailsPresent(application)) {
        throw new AppError(
          400,
          "GENERATED_DOCUMENT_REQUIRES_NOT_MET",
          "An offer has not been sent yet."
        );
      }
    }
  }
}

function offerDocumentBasename(prefix: string, issuerName: string): string {
  const safeName = (issuerName || "issuer").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  return `${prefix}-${safeName || "issuer"}`;
}

function readOfferSentAt(offerDetails: unknown): string {
  if (!offerDetails || typeof offerDetails !== "object" || Array.isArray(offerDetails)) return "";
  const sentAt = (offerDetails as { sent_at?: unknown }).sent_at;
  return typeof sentAt === "string" ? sentAt.trim() : "";
}

function readTrusteeDisclosureEmail(trusteeLetterConfig: unknown): string {
  if (!trusteeLetterConfig || typeof trusteeLetterConfig !== "object" || Array.isArray(trusteeLetterConfig)) {
    return "";
  }
  const email = (trusteeLetterConfig as { trusteeEmail?: unknown }).trusteeEmail;
  return typeof email === "string" ? email.trim() : "";
}

export class GeneratedDocumentsService {
  constructor(
    private readonly applicationRepository = new ApplicationRepository(),
    private readonly productRepository = new ProductRepository(),
    private readonly organizationRepository = new OrganizationRepository()
  ) {}

  listTypes(context?: GeneratedDocumentContext): GeneratedDocumentTypeDefinition[] {
    return context
      ? listGeneratedDocumentTypesForContext(context)
      : listGeneratedDocumentTypes();
  }

  getType(key: string): GeneratedDocumentTypeDefinition | undefined {
    return getGeneratedDocumentType(key);
  }

  private async verifyIssuerApplicationAccess(applicationId: string, userId: string): Promise<void> {
    const application = await this.applicationRepository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const organization = (application as { issuer_organization?: { owner_user_id?: string } })
      .issuer_organization;
    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found for this application");
    }

    if (organization.owner_user_id === userId) return;

    const member = await this.organizationRepository.getOrganizationMember(
      application.issuer_organization_id,
      userId,
      "issuer"
    );
    if (!member) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to this application");
    }
  }

  private async getFrozenProductWorkflow(application: {
    financing_type?: unknown;
    product_version?: number | null;
  }): Promise<unknown[]> {
    const financing = application.financing_type as { product_id?: string } | null | undefined;
    const productId = financing?.product_id;
    if (!productId || typeof productId !== "string") {
      throw new AppError(400, "VALIDATION_ERROR", "Application has no product configured.");
    }
    const productVersion = application.product_version;
    if (typeof productVersion !== "number" || !Number.isFinite(productVersion)) {
      throw new AppError(
        400,
        "PRODUCT_VERSION_NOT_FOUND",
        "Application has no frozen product version."
      );
    }
    const product = await this.productRepository.findByBaseAndVersion(productId, productVersion);
    if (!product) {
      throw new AppError(
        404,
        "PRODUCT_VERSION_NOT_FOUND",
        `Product version ${productVersion} was not found for this application.`
      );
    }
    return (product.workflow as unknown[]) ?? [];
  }

  private async loadApplicationForGenerate(applicationId: string) {
    const application = await this.applicationRepository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    return application;
  }

  async generateDocument(input: {
    applicationId: string;
    typeKey: string;
    format: GeneratedDocumentFormat;
    userId: string;
    asAdmin?: boolean;
    contractId?: string | null;
    invoiceId?: string | null;
  }): Promise<GeneratedDocumentResult> {
    const typeKey = parseGeneratedDocumentTypeKey(input.typeKey);
    if (!typeKey) {
      throw new AppError(400, "VALIDATION_ERROR", "Unknown generated document type.");
    }
    const typeDef = getGeneratedDocumentType(typeKey);
    if (!typeDef) {
      throw new AppError(400, "VALIDATION_ERROR", "Unknown generated document type.");
    }

    if (!input.asAdmin) {
      await this.verifyIssuerApplicationAccess(input.applicationId, input.userId);
    }

    const application = await this.loadApplicationForGenerate(input.applicationId);
    const workflow = await this.getFrozenProductWorkflow(application);

    if (!workflowDeclaresGeneratedDocumentType(workflow, typeKey)) {
      throw new AppError(
        400,
        "GENERATED_DOCUMENT_NOT_CONFIGURED",
        "This product version does not configure the requested generated document."
      );
    }

    assertRequiresMet(
      typeDef.requires,
      application as {
        contract?: { offer_details?: unknown } | null;
        invoices?: Array<{ offer_details?: unknown }> | null;
      }
    );

    switch (typeKey) {
      case "arf_contract_facility_lo":
        return this.generateArfContractFacilityLo(
          application,
          typeDef,
          input.format,
          workflow,
          input.userId
        );
      case "arf_joint_several_guarantee":
        return this.generateArfJointSeveralGuarantee(
          application,
          typeDef,
          input.format,
          input.userId
        );
      case "arf_deed_of_assignment":
        return this.generateArfDeedOfAssignment(
          application,
          typeDef,
          input.format,
          input.userId
        );
      case "arf_facility_agreement":
        return this.generateArfFacilityAgreement(
          application,
          typeDef,
          input.format,
          workflow,
          input.userId,
          input.contractId,
          input.invoiceId
        );
    }
  }

  private requireContractForGenerate(
    application: Awaited<ReturnType<ApplicationRepository["findById"]>>,
    missingMessage: string
  ): Record<string, unknown> {
    const contract = (application as { contract?: Record<string, unknown> | null }).contract;
    if (!contract) {
      throw new AppError(400, "GENERATED_DOCUMENT_REQUIRES_NOT_MET", missingMessage);
    }
    return contract;
  }

  private requireIssuerOrganization(
    application: Awaited<ReturnType<ApplicationRepository["findById"]>>
  ): {
    id: string;
    name?: string | null;
    registration_number?: string | null;
    address?: string | null;
    phone_number?: string | null;
    bank_account_details?: unknown;
    corporate_onboarding_data?: unknown;
  } {
    const issuerOrganization = (
      application as {
        issuer_organization?: {
          id: string;
          name?: string | null;
          registration_number?: string | null;
          address?: string | null;
          phone_number?: string | null;
          bank_account_details?: unknown;
          corporate_onboarding_data?: unknown;
        };
      }
    ).issuer_organization;
    if (!issuerOrganization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Issuer organization not found.");
    }
    return issuerOrganization;
  }

  private async resolveOfferDocumentGuarantors(
    application: Awaited<ReturnType<ApplicationRepository["findById"]>>,
    contract: Record<string, unknown>
  ): Promise<{
    liveGuarantors: unknown;
    financingStructureType: ReturnType<typeof readFinancingStructureType>;
  }> {
    const financingStructureType = readFinancingStructureType(application!.financing_structure);
    let liveGuarantors = (application as { application_guarantors?: unknown }).application_guarantors;
    if (isInheritedFacilityGuarantorReview(financingStructureType) && application!.contract_id) {
      const inherited = await loadInheritedGuarantorsForExistingContract(prisma, {
        contractId: application!.contract_id,
        originatingApplicationId:
          (contract as { originating_application_id?: string | null }).originating_application_id ??
          null,
      });
      if (inherited) {
        liveGuarantors = inherited.application_guarantors;
      }
    }
    return { liveGuarantors, financingStructureType };
  }

  private async generateArfContractFacilityLo(
    application: Awaited<ReturnType<ApplicationRepository["findById"]>>,
    typeDef: GeneratedDocumentTypeDefinition,
    format: GeneratedDocumentFormat,
    productWorkflow: unknown[],
    createdByUserId: string
  ): Promise<GeneratedDocumentResult> {
    const contract = this.requireContractForGenerate(
      application,
      "Application has no contract for letter of offer generation."
    );
    const issuerOrganization = this.requireIssuerOrganization(application);

    let gracePeriodDaysDefault: number | null = null;
    try {
      const settings = await prisma.platformFinanceSetting.findFirst({
        orderBy: { updated_at: "desc" },
      });
      if (settings && typeof settings.grace_period_days === "number") {
        gracePeriodDaysDefault = settings.grace_period_days;
      }
    } catch {
      // Platform finance settings may be unavailable in some envs.
    }

    const { liveGuarantors, financingStructureType } = await this.resolveOfferDocumentGuarantors(
      application,
      contract
    );

    const mergeData = buildFacilityLoMergeData({
      contract: {
        id: String(contract.id),
        issuer_organization_id: String(contract.issuer_organization_id),
        contract_details: contract.contract_details,
        offer_details: contract.offer_details,
        customer_details: contract.customer_details,
      },
      issuerOrganization: {
        id: issuerOrganization.id,
        name: issuerOrganization.name,
        registration_number: issuerOrganization.registration_number,
        address: issuerOrganization.address,
        corporate_onboarding_data: issuerOrganization.corporate_onboarding_data,
      },
      application: {
        id: application!.id,
        company_details: application!.company_details,
        business_details: application!.business_details,
        application_guarantors: liveGuarantors,
      },
      financingStructureType,
      gracePeriodDaysDefault,
      productWorkflow,
    });

    const liveGuarantorCount = Array.isArray(liveGuarantors) ? liveGuarantors.length : 0;
    assertFacilityLoMergeReady({
      mergeData,
      sentAt: readOfferSentAt(contract.offer_details),
      authorizedParties: getLoAuthorizedPartiesFromAcceptance(
        getOfferAcceptanceFromOfferDetails(contract.offer_details)
      ),
      liveGuarantorCount,
    });

    return this.finalizeGeneratedDocument({
      applicationId: application!.id,
      contractId: typeof contract.id === "string" ? contract.id : null,
      typeDef,
      format,
      createdByUserId,
      templateBytes: readFacilityLoTemplateBytes(),
      docxBuffer: renderFacilityLoDocx(mergeData),
      basename: offerDocumentBasename("ARF-LO", mergeData.issuer_name),
    });
  }

  private async generateArfJointSeveralGuarantee(
    application: Awaited<ReturnType<ApplicationRepository["findById"]>>,
    typeDef: GeneratedDocumentTypeDefinition,
    format: GeneratedDocumentFormat,
    createdByUserId: string
  ): Promise<GeneratedDocumentResult> {
    const contract = this.requireContractForGenerate(
      application,
      "Application has no contract for joint and several guarantee generation."
    );
    const issuerOrganization = this.requireIssuerOrganization(application);
    const { liveGuarantors } = await this.resolveOfferDocumentGuarantors(application, contract);

    const mergeData = buildJsgMergeData({
      contract: {
        id: String(contract.id),
        issuer_organization_id: String(contract.issuer_organization_id),
        contract_details: contract.contract_details,
        offer_details: contract.offer_details,
      },
      issuerOrganization: {
        id: issuerOrganization.id,
        name: issuerOrganization.name,
        registration_number: issuerOrganization.registration_number,
        address: issuerOrganization.address,
        corporate_onboarding_data: issuerOrganization.corporate_onboarding_data,
      },
      application: {
        id: application!.id,
        application_guarantors: liveGuarantors,
      },
    });

    const liveGuarantorCount = Array.isArray(liveGuarantors) ? liveGuarantors.length : 0;
    assertJsgMergeReady({
      mergeData,
      sentAt: readOfferSentAt(contract.offer_details),
      authorizedParties: getLoAuthorizedPartiesFromAcceptance(
        getOfferAcceptanceFromOfferDetails(contract.offer_details)
      ),
      liveGuarantorCount,
    });

    return this.finalizeGeneratedDocument({
      applicationId: application!.id,
      contractId: typeof contract.id === "string" ? contract.id : null,
      typeDef,
      format,
      createdByUserId,
      templateBytes: readJsgTemplateBytes(),
      docxBuffer: renderJsgDocx(mergeData),
      basename: offerDocumentBasename("ARF-JSG", mergeData.issuer_name),
    });
  }

  private async generateArfDeedOfAssignment(
    application: Awaited<ReturnType<ApplicationRepository["findById"]>>,
    typeDef: GeneratedDocumentTypeDefinition,
    format: GeneratedDocumentFormat,
    createdByUserId: string
  ): Promise<GeneratedDocumentResult> {
    const contract = this.requireContractForGenerate(
      application,
      "Application has no contract for deed of assignment generation."
    );
    const issuerOrganization = this.requireIssuerOrganization(application);

    let ledgerBucketAccountsConfig: unknown = null;
    try {
      const settings = await prisma.platformFinanceSetting.findFirst({
        orderBy: { updated_at: "desc" },
        select: { ledger_bucket_accounts_config: true },
      });
      ledgerBucketAccountsConfig = settings?.ledger_bucket_accounts_config ?? null;
    } catch {
      // Platform finance settings may be unavailable in some envs.
    }

    const mergeData = buildDeedOfAssignmentMergeData({
      contract: {
        id: String(contract.id),
        issuer_organization_id: String(contract.issuer_organization_id),
        contract_details: contract.contract_details,
        offer_details: contract.offer_details,
        customer_details: contract.customer_details,
      },
      issuerOrganization: {
        id: issuerOrganization.id,
        name: issuerOrganization.name,
        registration_number: issuerOrganization.registration_number,
        address: issuerOrganization.address,
        phone_number: issuerOrganization.phone_number,
        corporate_onboarding_data: issuerOrganization.corporate_onboarding_data,
      },
      application: {
        id: application!.id,
        company_details: application!.company_details,
        invoices: (application as { invoices?: unknown }).invoices,
      },
      ledgerBucketAccountsConfig,
    });

    assertDeedOfAssignmentMergeReady({
      mergeData,
      sentAt: readOfferSentAt(contract.offer_details),
      authorizedParties: getLoAuthorizedPartiesFromAcceptance(
        getOfferAcceptanceFromOfferDetails(contract.offer_details)
      ),
    });

    return this.finalizeGeneratedDocument({
      applicationId: application!.id,
      contractId: typeof contract.id === "string" ? contract.id : null,
      typeDef,
      format,
      createdByUserId,
      templateBytes: readDeedOfAssignmentTemplateBytes(),
      docxBuffer: renderDeedOfAssignmentDocx(mergeData),
      basename: offerDocumentBasename("ARF-DOA", mergeData.assignor_company_name),
    });
  }

  private resolveFacilityAgreementOfferTarget(
    application: Awaited<ReturnType<ApplicationRepository["findById"]>>,
    contract: Record<string, unknown>,
    contractId?: string | null,
    invoiceId?: string | null
  ): {
    offerKind: "contract" | "invoice";
    invoice: { id: string; display_reference?: unknown; offer_details?: unknown } | null;
    offerDetails: unknown;
  } {
    const invoices = (
      application as {
        invoices?: Array<{ id?: unknown; display_reference?: unknown; offer_details?: unknown }>;
      }
    ).invoices;
    const invoiceRows = Array.isArray(invoices) ? invoices : [];

    if (contractId && invoiceId) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Choose either a facility or invoice offer, not both."
      );
    }

    if (invoiceId) {
      const invoice = invoiceRows.find((row) => String(row.id) === invoiceId);
      if (!invoice || typeof invoice.id !== "string") {
        throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found on this application.");
      }
      if (!offerDetailsPresent(invoice.offer_details)) {
        throw new AppError(
          400,
          "GENERATED_DOCUMENT_REQUIRES_NOT_MET",
          "Invoice offer has not been sent yet."
        );
      }
      return {
        offerKind: "invoice",
        invoice: {
          id: invoice.id,
          display_reference: invoice.display_reference,
          offer_details: invoice.offer_details,
        },
        offerDetails: invoice.offer_details,
      };
    }

    if (contractId && String(contract.id) !== contractId) {
      throw new AppError(400, "INVALID_STATE", "Facility offer is not available for this document.");
    }

    if (offerDetailsPresent(contract.offer_details)) {
      return { offerKind: "contract", invoice: null, offerDetails: contract.offer_details };
    }

    const invoice = invoiceRows.find((row) => offerDetailsPresent(row.offer_details));
    if (invoice && typeof invoice.id === "string") {
      return {
        offerKind: "invoice",
        invoice: {
          id: invoice.id,
          display_reference: invoice.display_reference,
          offer_details: invoice.offer_details,
        },
        offerDetails: invoice.offer_details,
      };
    }

    throw new AppError(
      400,
      "GENERATED_DOCUMENT_REQUIRES_NOT_MET",
      "An offer has not been sent yet."
    );
  }

  private async generateArfFacilityAgreement(
    application: Awaited<ReturnType<ApplicationRepository["findById"]>>,
    typeDef: GeneratedDocumentTypeDefinition,
    format: GeneratedDocumentFormat,
    productWorkflow: unknown[],
    createdByUserId: string,
    contractId?: string | null,
    invoiceId?: string | null
  ): Promise<GeneratedDocumentResult> {
    const contract = this.requireContractForGenerate(
      application,
      "Application has no contract for facility agreement generation."
    );
    const issuerOrganization = this.requireIssuerOrganization(application);
    const target = this.resolveFacilityAgreementOfferTarget(
      application,
      contract,
      contractId,
      invoiceId
    );
    const { liveGuarantors } = await this.resolveOfferDocumentGuarantors(application, contract);

    let trusteeDisclosureEmail = "";
    try {
      const settings = await prisma.platformFinanceSetting.findFirst({
        orderBy: { updated_at: "desc" },
        select: { trustee_letter_config: true },
      });
      trusteeDisclosureEmail = readTrusteeDisclosureEmail(settings?.trustee_letter_config);
    } catch {
      // Platform finance settings may be unavailable in some envs.
    }

    const mergeData = buildFacilityAgreementMergeData({
      offerKind: target.offerKind,
      contract: {
        id: String(contract.id),
        issuer_organization_id: String(contract.issuer_organization_id),
        contract_details: contract.contract_details,
        offer_details: contract.offer_details,
      },
      invoice: target.invoice,
      issuerOrganization: {
        id: issuerOrganization.id,
        name: issuerOrganization.name,
        registration_number: issuerOrganization.registration_number,
        address: issuerOrganization.address,
        bank_account_details: issuerOrganization.bank_account_details,
        corporate_onboarding_data: issuerOrganization.corporate_onboarding_data,
      },
      application: {
        id: application!.id,
        company_details: application!.company_details,
        application_guarantors: liveGuarantors,
      },
      productWorkflow,
      trusteeDisclosureEmail,
    });

    const liveGuarantorCount = Array.isArray(liveGuarantors) ? liveGuarantors.length : 0;
    assertFacilityAgreementMergeReady({
      mergeData,
      sentAt: readOfferSentAt(target.offerDetails),
      authorizedParties: getLoAuthorizedPartiesFromAcceptance(
        getOfferAcceptanceFromOfferDetails(target.offerDetails)
      ),
      liveGuarantorCount,
    });

    return this.finalizeGeneratedDocument({
      applicationId: application!.id,
      contractId: typeof contract.id === "string" ? contract.id : null,
      invoiceId: target.invoice?.id ?? null,
      typeDef,
      format,
      createdByUserId,
      templateBytes: readFacilityAgreementTemplateBytes(),
      docxBuffer: renderFacilityAgreementDocx(mergeData),
      basename: offerDocumentBasename("ARF-FA", mergeData.issuer_name),
    });
  }

  private async finalizeGeneratedDocument(input: {
    applicationId: string;
    contractId: string | null;
    invoiceId?: string | null;
    typeDef: GeneratedDocumentTypeDefinition;
    format: GeneratedDocumentFormat;
    createdByUserId: string;
    templateBytes: Buffer;
    docxBuffer: Buffer;
    basename: string;
  }): Promise<GeneratedDocumentResult> {
    const templateSha256 = crypto.createHash("sha256").update(input.templateBytes).digest("hex");
    logger.info(
      {
        applicationId: input.applicationId,
        generatedDocumentType: input.typeDef.key,
        templateVersion: input.typeDef.version,
        templateSha256,
      },
      "Generated document template resolved"
    );

    if (input.format === "docx") {
      const outputSha256 = crypto.createHash("sha256").update(input.docxBuffer).digest("hex");
      await this.persistGeneratedDocumentEvidence({
        applicationId: input.applicationId,
        contractId: input.contractId,
        invoiceId: input.invoiceId ?? null,
        typeDef: input.typeDef,
        format: input.format,
        templateSha256,
        outputSha256,
        createdByUserId: input.createdByUserId,
      });
      return {
        buffer: input.docxBuffer,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename: `${input.basename}.docx`,
        templateSha256,
        outputSha256,
        type: input.typeDef,
      };
    }

    try {
      const pdfBuffer = await convertDocxToPdf(input.docxBuffer);
      const outputSha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
      await this.persistGeneratedDocumentEvidence({
        applicationId: input.applicationId,
        contractId: input.contractId,
        invoiceId: input.invoiceId ?? null,
        typeDef: input.typeDef,
        format: input.format,
        templateSha256,
        outputSha256,
        createdByUserId: input.createdByUserId,
      });
      return {
        buffer: pdfBuffer,
        contentType: "application/pdf",
        filename: `${input.basename}.pdf`,
        templateSha256,
        outputSha256,
        type: input.typeDef,
      };
    } catch (err) {
      if (err instanceof DocxToPdfError) {
        const status =
          err.code === "GOTENBERG_MISSING" || err.code === "GOTENBERG_UNAVAILABLE" ? 503 : 500;
        throw new AppError(status, err.code, err.message);
      }
      throw err;
    }
  }

  private async persistGeneratedDocumentEvidence(input: {
    applicationId: string;
    contractId: string | null;
    invoiceId?: string | null;
    typeDef: GeneratedDocumentTypeDefinition;
    format: GeneratedDocumentFormat;
    templateSha256: string;
    outputSha256: string;
    createdByUserId: string;
  }): Promise<void> {
    await prisma.generatedDocumentEvidence.create({
      data: {
        application_id: input.applicationId,
        contract_id: input.contractId,
        invoice_id: input.invoiceId ?? null,
        document_type: input.typeDef.key,
        template_version: String(input.typeDef.version),
        template_sha256: input.templateSha256,
        output_sha256: input.outputSha256,
        format: input.format,
        created_by_user_id: input.createdByUserId,
      },
    });
  }
}

export const generatedDocumentsService = new GeneratedDocumentsService();
