import { InvoiceRepository } from "./repository";
import { ApplicationRepository } from "../applications/repository";
import { OrganizationRepository } from "../organization/repository";
import { ContractRepository } from "../contracts/repository";
import { AppError } from "../../lib/http/error-handler";
import { Invoice } from "@prisma/client";
import {
  generateApplicationDocumentKey,
  parseApplicationDocumentKey,
  generatePresignedUploadUrl,
  getFileExtension,
  validateDocument,
  deleteS3Object,
} from "../../lib/s3/client";
import { logger } from "../../lib/logger";

export class InvoiceService {
  private repository: InvoiceRepository;
  private applicationRepository: ApplicationRepository;
  private organizationRepository: OrganizationRepository;
  private contractRepository: ContractRepository;

  constructor() {
    this.repository = new InvoiceRepository();
    this.applicationRepository = new ApplicationRepository();
    this.organizationRepository = new OrganizationRepository();
    this.contractRepository = new ContractRepository();
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

    return this.repository.create({
      application_id: applicationId,
      contract_id: contractId,
      details,
    });
  }

  async getInvoice(id: string, userId: string): Promise<Invoice> {
    return this.verifyInvoiceAccess(id, userId);
  }

  async updateInvoice(id: string, payload: any, userId: string): Promise<Invoice> {
    const invoice = await this.verifyInvoiceAccess(id, userId);

    if (invoice.status === "APPROVED") {
      throw new AppError(400, "BAD_REQUEST", "Cannot update an approved invoice");
    }

    /**
     * PARSE PAYLOAD
     *
     * Payload can contain:
     * - individual detail fields (number, value, maturity_date, financing_ratio_percent, document)
     * - contractId (optional, can be null or cuid)
     */
    const { contractId, ...detailsPayload } = payload;

    const prevS3Key = (invoice.details as any)?.document?.s3_key;
    const nextS3Key = detailsPayload?.document?.s3_key;

    const updatedDetails = Object.keys(detailsPayload).length > 0 ? {
      ...(invoice.details as object),
      ...detailsPayload,
    } : invoice.details;

    /**
     * UPDATE INVOICE WITH OPTIONAL CONTRACT ID
     *
     * Build update payload with contract_id if provided
     * contractId can be: undefined (skip), null (clear), or a cuid string (set)
     */
    const updatePayload: any = {
      details: updatedDetails,
      updated_at: new Date(),
    };

    if (contractId !== undefined) {
      updatePayload.contract_id = contractId;
      logger.info({ invoiceId: id, contractId }, "Updating invoice contract_id");
    }

    const updatedInvoice = await this.repository.update(id, updatePayload);

    // 🔥 delete previous version AFTER successful update
    if (
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
    }

    return updatedInvoice;
  }





async deleteInvoice(id: string, userId: string) {
  const invoice = await this.verifyInvoiceAccess(id, userId);

  const s3Key = (invoice.details as any)?.document?.s3_key;

  // delete DB first OR last — your choice
  await this.repository.delete(id);

  if (s3Key) {
    try {
      await deleteS3Object(s3Key);
    } catch (err) {
      logger.error({ id, s3Key, err }, "Failed to delete invoice S3 object");
    }
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
    await this.verifyInvoiceAccess(invoiceId, userId);

    try {
      await deleteS3Object(s3Key);
    } catch (error) {
      throw new AppError(500, "DELETE_FAILED", "Failed to delete document from S3");
    }
  }
}

export const invoiceService = new InvoiceService();

