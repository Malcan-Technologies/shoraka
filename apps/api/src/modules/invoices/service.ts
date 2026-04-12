import { InvoiceRepository } from "./repository";
import { ApplicationRepository } from "../applications/repository";
import { OrganizationRepository } from "../organization/repository";
import { ContractRepository } from "../contracts/repository";
import { AppError } from "../../lib/http/error-handler";
import { logApplicationActivity } from "../applications/logs/service";
import { ActivityPortal } from "../applications/logs/types";
import { Invoice } from "@prisma/client";
import { ApplicationStatus, ContractStatus, InvoiceStatus, WithdrawReason } from "@cashsouk/types";
import { computeApplicationStatus } from "../applications/lifecycle";
import {
  generateApplicationDocumentKey,
  parseApplicationDocumentKey,
  generatePresignedUploadUrl,
  getFileExtension,
  validateDocument,
  deleteS3Object,
} from "../../lib/s3/client";
import { logger } from "../../lib/logger";
import { ProductRepository } from "../products/repository";
import { assertMaturityForApplication } from "../products/validate-financial-config";
import { shouldPreserveApplicationDocumentsInS3 } from "../applications/amendment-preserve-s3";

export class InvoiceService {
  private repository: InvoiceRepository;
  private applicationRepository: ApplicationRepository;
  private organizationRepository: OrganizationRepository;
  private contractRepository: ContractRepository;
  private productRepository: ProductRepository;

  constructor() {
    this.repository = new InvoiceRepository();
    this.applicationRepository = new ApplicationRepository();
    this.organizationRepository = new OrganizationRepository();
    this.contractRepository = new ContractRepository();
    this.productRepository = new ProductRepository();
  }

  private async loadWorkflowForApplication(applicationId: string): Promise<unknown | null> {
    const app = await this.applicationRepository.findById(applicationId);
    const productId = (app?.financing_type as { product_id?: string } | null)?.product_id;
    if (!productId) return null;
    const product = await this.productRepository.findById(productId);
    return product?.workflow ?? null;
  }

  private async verifyInvoiceAccess(invoiceId: string, userId: string): Promise<Invoice> {
    const invoice = await this.repository.findById(invoiceId);
    if (!invoice) {
      throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
    }

    const application = (invoice as any).application;
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found for this invoice");
    }

    const organization = application.issuer_organization;
    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
    }

    if (organization.owner_user_id === userId) {
      return invoice;
    }

    const member = await this.organizationRepository.getOrganizationMember(
      organization.id,
      userId,
      "issuer"
    );

    if (!member) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to this invoice.");
    }

    return invoice;
  }

  private async verifyApplicationAccess(applicationId: string, userId: string): Promise<any> {
    const application = await this.applicationRepository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const organization = (application as any).issuer_organization;
    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
    }

    if (organization.owner_user_id === userId) {
      return application;
    }

    const member = await this.organizationRepository.getOrganizationMember(
      organization.id,
      userId,
      "issuer"
    );

    if (!member) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to this application.");
    }

    return application;
  }

  private async verifyContractAccess(contractId: string, userId: string): Promise<any> {
    const contract = await this.contractRepository.findById(contractId);
    if (!contract) {
      throw new AppError(404, "CONTRACT_NOT_FOUND", "Contract not found");
    }

    const organizationId = contract.issuer_organization_id;
    const organization = (contract as any).issuer_organization;
    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found for this contract");
    }

    if (organization.owner_user_id === userId) {
      return contract;
    }

    const member = await this.organizationRepository.getOrganizationMember(
      organizationId,
      userId,
      "issuer"
    );

    if (!member) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to this contract.");
    }

    return contract;
  }

  async createInvoice(applicationId: string, contractId: string | undefined, details: any, userId: string): Promise<Invoice> {
    await this.verifyApplicationAccess(applicationId, userId);

    const workflow = await this.loadWorkflowForApplication(applicationId);
    if (workflow) {
      assertMaturityForApplication(workflow, details as Record<string, unknown>);
    }

    const s3Key = details?.document?.s3_key;

    try {
      return await this.repository.create({
        application_id: applicationId,
        contract_id: contractId,
        details,
      });
    } catch (err) {
      if (s3Key) {
        try {
          await deleteS3Object(s3Key);
          logger.info({ applicationId, s3Key }, "Deleted orphan invoice document after create failure");
        } catch (delErr) {
          logger.warn({ applicationId, s3Key, err: delErr }, "Cleanup: failed to delete orphan invoice document");
        }
      }
      throw err;
    }
  }

  async getInvoice(id: string, userId: string): Promise<Invoice> {
    return this.verifyInvoiceAccess(id, userId);
  }

  async updateInvoice(id: string, payload: any, userId: string): Promise<Invoice> {
  const invoice = await this.verifyInvoiceAccess(id, userId);

  if (invoice.status === InvoiceStatus.APPROVED) {
    throw new AppError(400, "BAD_REQUEST", "Cannot update an approved invoice");
  }

  /**
   * PARSE PAYLOAD
   * Can contain:
   * - details: partial invoice details
   * - document: top-level document field
   * - contractId: optional, can be null or cuid string
   */
  const { contractId, details, document, ...otherFields } = payload;

  const prevS3Key = (invoice.details as any)?.document?.s3_key;
  const nextS3Key = document?.s3_key;

  /**
   * MERGE DETAILS
   * Combine existing details with new details and document
   */
  let updatedDetails = invoice.details as object;

  if (details && Object.keys(details).length > 0) {
    updatedDetails = {
      ...updatedDetails,
      ...details,
    };
  }

  if (document !== undefined) {
    updatedDetails = {
      ...updatedDetails,
      document,
    };
  }

  if (Object.keys(otherFields).length > 0) {
    updatedDetails = {
      ...updatedDetails,
      ...otherFields,
    };
  }

  const applicationId = (invoice as { application_id: string }).application_id;
  const applicationRow = applicationId
    ? await this.applicationRepository.findById(applicationId)
    : null;
  const preserveInvoiceDocsInAmendment = shouldPreserveApplicationDocumentsInS3(
    (applicationRow as { status?: string } | null)?.status
  );
  const workflow = await this.loadWorkflowForApplication(applicationId);
  if (workflow) {
    assertMaturityForApplication(workflow, updatedDetails as Record<string, unknown>);
  }

  /**
   * BUILD UPDATE PAYLOAD
   * Include contractId if provided
   */
  const updatePayload: any = {
    details: updatedDetails,
    updated_at: new Date(),
  };

  if (contractId !== undefined) {
    updatePayload.contract_id = contractId;
  }

  const isNewDocumentUpload = nextS3Key && nextS3Key !== prevS3Key;

  try {
    const updatedInvoice = await this.repository.update(id, updatePayload);

    if (
      !preserveInvoiceDocsInAmendment &&
      prevS3Key &&
      nextS3Key &&
      prevS3Key !== nextS3Key
    ) {
      try {
        await deleteS3Object(prevS3Key);
        logger.info(
          { invoiceId: id, prevS3Key, nextS3Key },
          "Old invoice document deleted after version replacement"
        );
      } catch (err) {
        logger.error(
          { invoiceId: id, prevS3Key, err },
          "Failed to delete old invoice document from S3"
        );
      }
    } else if (
      preserveInvoiceDocsInAmendment &&
      prevS3Key &&
      nextS3Key &&
      prevS3Key !== nextS3Key
    ) {
      logger.info(
        { invoiceId: id, prevS3Key, nextS3Key },
        "Skipped old invoice document S3 delete: AMENDMENT_REQUESTED (preserve for compare/audit)"
      );
    }

    return updatedInvoice;
  } catch (err) {
    if (isNewDocumentUpload && nextS3Key) {
      try {
        await deleteS3Object(nextS3Key);
        logger.info({ invoiceId: id, s3Key: nextS3Key }, "Deleted orphan invoice document after update failure");
      } catch (delErr) {
        logger.warn({ invoiceId: id, s3Key: nextS3Key, err: delErr }, "Cleanup: failed to delete orphan invoice document");
      }
    }
    throw err;
  }
}





async deleteInvoice(id: string, userId: string) {
  const invoice = await this.verifyInvoiceAccess(id, userId);

  const s3Key = (invoice.details as any)?.document?.s3_key;
  const application = invoice.application_id
    ? await this.applicationRepository.findById(invoice.application_id)
    : null;

  // delete DB first OR last — your choice
  await this.repository.delete(id);

  if (
    s3Key &&
    !shouldPreserveApplicationDocumentsInS3((application as { status?: string } | null)?.status)
  ) {
    try {
      await deleteS3Object(s3Key);
    } catch (err) {
      logger.error({ id, s3Key, err }, "Failed to delete invoice S3 object");
    }
  } else if (s3Key) {
    logger.info(
      { invoiceId: id, s3Key },
      "Skipped invoice S3 delete on invoice row removal: AMENDMENT_REQUESTED (preserve for compare/audit)"
    );
  }
}


  async getInvoicesByApplication(applicationId: string, userId: string): Promise<Invoice[]> {
    await this.verifyApplicationAccess(applicationId, userId);
    return this.repository.findByApplicationId(applicationId);
  }

  async getInvoicesByContract(contractId: string, userId: string): Promise<Invoice[]> {
    await this.verifyContractAccess(contractId, userId);
    return this.repository.findByContractId(contractId);
  }

  async requestUploadUrl(params: {
    invoiceId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    existingS3Key?: string;
    userId: string;
  }): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number }> {
    await this.verifyInvoiceAccess(params.invoiceId, params.userId);

    const validation = validateDocument({
      contentType: params.contentType,
      fileSize: params.fileSize,
    });

    if (!validation.valid) {
      throw new AppError(400, "VALIDATION_ERROR", validation.error || "Invalid file");
    }

    const extension = getFileExtension(params.fileName) || "pdf";
    let s3Key: string;

    const invoice = await this.verifyInvoiceAccess(params.invoiceId, params.userId);
    const applicationId = (invoice as any).application_id;

    if (params.existingS3Key) {
      logger.debug({ existingS3Key: params.existingS3Key, invoiceId: params.invoiceId }, "invoice.requestUploadUrl received existingS3Key");
      // Prefer parsing the existing key to extract cuid and version, then bump version while keeping cuid
      const parsed = parseApplicationDocumentKey(params.existingS3Key);
      if (!parsed) {
        logger.warn({ key: params.existingS3Key }, "Failed to parse existingS3Key with parseApplicationDocumentKey");
        throw new AppError(400, "INVALID_S3_KEY", "Failed to parse existing S3 key for versioning");
      }

      const newVersion = parsed.version + 1;
      logger.debug({ parsed, newVersion }, "invoice.requestUploadUrl parsed existing key");
      const date = new Date().toISOString().split("T")[0];
      s3Key = `applications/${parsed.applicationId}/v${newVersion}-${date}-${parsed.cuid}.${extension}`;
    } else {
      const cuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      s3Key = generateApplicationDocumentKey({
        applicationId: String(applicationId),
        cuid,
        extension,
      });
    }

    const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: params.contentType,
      contentLength: params.fileSize,
    });

    return { uploadUrl, s3Key, expiresIn };
  }

  async deleteDocument(invoiceId: string, s3Key: string, userId: string): Promise<void> {
    const invoice = await this.verifyInvoiceAccess(invoiceId, userId);
    const application = invoice.application_id
      ? await this.applicationRepository.findById(invoice.application_id)
      : null;

    if (shouldPreserveApplicationDocumentsInS3((application as { status?: string } | null)?.status)) {
      logger.info(
        { invoiceId, s3Key },
        "Skipped invoice document S3 delete: AMENDMENT_REQUESTED (preserve for compare/audit)"
      );
      return;
    }

    try {
      await deleteS3Object(s3Key);
    } catch (error) {
      throw new AppError(500, "DELETE_FAILED", "Failed to delete document from S3");
    }
  }

  async withdrawInvoice(id: string, userId: string, reason?: WithdrawReason): Promise<Invoice> {
    const invoice = await this.verifyInvoiceAccess(id, userId);

    if (invoice.status === InvoiceStatus.APPROVED) {
      throw new AppError(400, "BAD_REQUEST", "This invoice has already been approved and can no longer be withdrawn.");
    }

    if (invoice.status === InvoiceStatus.WITHDRAWN) {
      throw new AppError(400, "BAD_REQUEST", "This invoice was already withdrawn.");
    }

    const finalReason = reason ?? WithdrawReason.USER_CANCELLED;

    const updated = await this.repository.update(id, {
      status: InvoiceStatus.WITHDRAWN,
      withdraw_reason: finalReason,
    });

    if (invoice.application_id) {
      const details = invoice.details as Record<string, unknown> | null;
      const invoiceNumber = details?.number != null ? String(details.number) : undefined;
      await logApplicationActivity({
        userId,
        applicationId: invoice.application_id,
        eventType: "INVOICE_WITHDRAWN",
        portal: ActivityPortal.ISSUER,
        entityId: id,
        metadata: { withdraw_reason: finalReason, invoice_number: invoiceNumber },
      });

      const allInvoices = await this.repository.findByApplicationId(invoice.application_id);
      const app = await this.applicationRepository.findById(invoice.application_id);
      const contract = app?.contract_id
        ? await this.contractRepository.findById(app.contract_id)
        : null;
      const currentStatus = (app?.status as ApplicationStatus) ?? ApplicationStatus.DRAFT;
      const isInvoiceOnly =
        (app?.financing_structure as { structure_type?: string } | null)?.structure_type === "invoice_only";
      const newStatus = computeApplicationStatus(
        contract ? { status: contract.status as ContractStatus } : null,
        allInvoices.map((i) => ({ status: i.status as InvoiceStatus })),
        currentStatus,
        { isInvoiceOnly }
      );
      if (newStatus === ApplicationStatus.WITHDRAWN && currentStatus !== ApplicationStatus.WITHDRAWN) {
        const { prisma } = await import("../../lib/prisma");
        await prisma.application.update({
          where: { id: invoice.application_id },
          data: { status: ApplicationStatus.WITHDRAWN },
        });
        await logApplicationActivity({
          userId,
          applicationId: invoice.application_id,
          eventType: "APPLICATION_WITHDRAWN",
          portal: ActivityPortal.ISSUER,
          metadata: { withdraw_reason: finalReason },
        });
      }
    }

    return updated;
  }
}

export const invoiceService = new InvoiceService();
