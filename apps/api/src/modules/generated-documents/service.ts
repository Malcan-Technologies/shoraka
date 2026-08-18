import crypto from "crypto";
import {
  getGeneratedDocumentType,
  listGeneratedDocumentTypes,
  listGeneratedDocumentTypesForContext,
  parseGeneratedDocumentTypeKey,
  resolveAcceptanceDocumentsFromWorkflow,
  parseSupportingDocumentRow,
  parseGuarantorAgreementRow,
  getStepKeyFromStepId,
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
import { buildContractLooMergeData } from "../applications/loo/build-contract-loo-merge-data";
import {
  readContractLooTemplateBytes,
  renderContractLooDocx,
} from "../applications/loo/render-contract-loo-docx";
import { convertDocxToPdf, DocxToPdfError } from "../applications/loo/convert-docx-to-pdf";

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

  return false;
}

function contractOfferDetailsPresent(application: {
  contract?: { offer_details?: unknown } | null;
}): boolean {
  const offer = application.contract?.offer_details;
  return offer != null && typeof offer === "object" && !Array.isArray(offer);
}

function assertRequiresMet(
  requires: GeneratedDocumentRequires[],
  application: { contract?: { offer_details?: unknown } | null }
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
  }
}

function looDownloadBasename(issuerName: string): string {
  const safeName = (issuerName || "issuer").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  return `ARF-LOO-${safeName || "issuer"}`;
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

    assertRequiresMet(typeDef.requires, application);

    switch (typeKey) {
      case "arf_contract_facility_loo":
        return this.generateArfContractFacilityLoo(application, typeDef, input.format);
      default:
        throw new AppError(400, "VALIDATION_ERROR", "Unsupported generated document type.");
    }
  }

  private async generateArfContractFacilityLoo(
    application: Awaited<ReturnType<ApplicationRepository["findById"]>>,
    typeDef: GeneratedDocumentTypeDefinition,
    format: GeneratedDocumentFormat
  ): Promise<GeneratedDocumentResult> {
    const contract = (application as { contract?: Record<string, unknown> | null }).contract;
    if (!contract) {
      throw new AppError(
        400,
        "GENERATED_DOCUMENT_REQUIRES_NOT_MET",
        "Application has no contract for letter of offer generation."
      );
    }

    const issuerOrganization = (application as {
      issuer_organization?: {
        id: string;
        name?: string | null;
        registration_number?: string | null;
        address?: string | null;
        corporate_onboarding_data?: unknown;
      };
    }).issuer_organization;
    if (!issuerOrganization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Issuer organization not found.");
    }

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

    const mergeData = buildContractLooMergeData({
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
      },
      gracePeriodDaysDefault,
    });

    const templateBytes = readContractLooTemplateBytes();
    const templateSha256 = crypto.createHash("sha256").update(templateBytes).digest("hex");
    logger.info(
      {
        applicationId: application!.id,
        generatedDocumentType: typeDef.key,
        templateVersion: typeDef.version,
        templateSha256,
      },
      "Generated document template resolved"
    );

    const docxBuffer = renderContractLooDocx(mergeData);
    const basename = looDownloadBasename(mergeData.issuer_name);

    if (format === "docx") {
      return {
        buffer: docxBuffer,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename: `${basename}.docx`,
        templateSha256,
        type: typeDef,
      };
    }

    try {
      const pdfBuffer = await convertDocxToPdf(docxBuffer);
      return {
        buffer: pdfBuffer,
        contentType: "application/pdf",
        filename: `${basename}.pdf`,
        templateSha256,
        type: typeDef,
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
}

export const generatedDocumentsService = new GeneratedDocumentsService();
