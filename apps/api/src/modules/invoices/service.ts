import { InvoiceRepository } from "./repository";
import { ApplicationRepository } from "../applications/repository";
import { OrganizationRepository } from "../organization/repository";
import { ContractRepository } from "../contracts/repository";
import { AppError } from "../../lib/http/error-handler";
import { Invoice } from "@prisma/client";
import {
  generateInvoiceDocumentKey,
  generatePresignedUploadUrl,
  getFileExtension,
  validateDocument,
} from "../../lib/s3/client";

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

  async updateInvoice(id: string, details: any, userId: string): Promise<Invoice> {
    const invoice = await this.verifyInvoiceAccess(id, userId);

    // Check if invoice is approved (cannot edit approved invoices)
    const currentDetails = invoice.details as any;
    if (currentDetails?.status === "APPROVED") {
      throw new AppError(400, "BAD_REQUEST", "Cannot update an approved invoice");
    }

    const updatedDetails = {
      ...(invoice.details as object),
      ...details,
    };

    return this.repository.update(id, {
      details: updatedDetails,
      updated_at: new Date(),
    });
  }

  async deleteInvoice(id: string, userId: string): Promise<void> {
    const invoice = await this.verifyInvoiceAccess(id, userId);

    // Check if invoice is approved (cannot delete approved invoices)
    const details = invoice.details as any;
    if (details?.status === "APPROVED") {
      throw new AppError(400, "BAD_REQUEST", "Cannot delete an approved invoice");
    }

    await this.repository.delete(id);
  }

  async getInvoicesByApplication(applicationId: string, userId: string): Promise<Invoice[]> {
    await this.verifyApplicationAccess(applicationId, userId);
    return this.repository.findByApplicationId(applicationId);
  }

  async getInvoicesByContract(contractId: string, userId: string): Promise<Invoice[]> {
    await this.verifyContractAccess(contractId, userId);
    return this.repository.findByContractId(contractId);
  }

  private generateCuid(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  async requestUploadUrl(params: {
    invoiceId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
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
    const cuid = this.generateCuid();

    const s3Key = generateInvoiceDocumentKey({
      invoiceId: params.invoiceId,
      cuid,
      extension,
    });

    const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: params.contentType,
      contentLength: params.fileSize,
    });

    return { uploadUrl, s3Key, expiresIn };
  }
}

export const invoiceService = new InvoiceService();
