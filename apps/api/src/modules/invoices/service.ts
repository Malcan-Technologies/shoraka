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

    // Facility validation
    if (contractId) {
      const contract = await this.contractRepository.findById(contractId);
      if (contract) {
        const contractDetails = contract.contract_details as any;
        const approvedFacility = contractDetails?.approved_facility || 0;
        const contractValue = contractDetails?.value || 0;
        const availableFacility = contractDetails?.available_facility || 0;

        const invoiceValue = details.value || 0;
        const financeAmount = invoiceValue * 0.8;

        if (approvedFacility > 0) {
          if (financeAmount > availableFacility) {
            throw new AppError(
              400,
              "FACILITY_LIMIT_EXCEEDED",
              `Max financing (${financeAmount}) exceeds available facility (${availableFacility})`
            );
          }

          // Decrement available capacity immediately as per requirement
          await this.contractRepository.update(contractId, {
            contract_details: {
              ...contractDetails,
              available_facility: availableFacility - financeAmount,
            },
          });
        } else {
          const existingInvoices = await this.repository.findAllByContractId(contractId);
          const totalFinancingAmount = existingInvoices.reduce(
            (sum, inv) => sum + ((inv.details as any).value || 0) * 0.8,
            0
          );

          if (totalFinancingAmount + financeAmount > contractValue) {
            throw new AppError(
              400,
              "CONTRACT_LIMIT_EXCEEDED",
              "Total financing amount exceeds contract value"
            );
          }
        }
      }
    }

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
    if (invoice.status === "APPROVED") {
      throw new AppError(400, "BAD_REQUEST", "Cannot update an approved invoice");
    }

    // Capacity validation and adjustment
    const oldFinanceAmount = ((invoice.details as any).value || 0) * 0.8;
    const newFinanceAmount =
      (details.value !== undefined ? details.value : ((invoice.details as any).value || 0)) * 0.8;
    const diff = newFinanceAmount - oldFinanceAmount;

    if (diff !== 0 && invoice.contract_id && invoice.status !== "REJECTED") {
      const contract = await this.contractRepository.findById(invoice.contract_id);
      if (contract) {
        const contractDetails = contract.contract_details as any;
        const approvedFacility = contractDetails?.approved_facility || 0;
        const availableFacility = contractDetails?.available_facility || 0;

        if (approvedFacility > 0) {
          if (diff > availableFacility) {
            throw new AppError(
              400,
              "FACILITY_LIMIT_EXCEEDED",
              `Updated financing diff (${diff}) exceeds available facility (${availableFacility})`
            );
          }

          // Update available capacity
          await this.contractRepository.update(invoice.contract_id, {
            contract_details: {
              ...contractDetails,
              available_facility: availableFacility - diff,
            },
          });
        } else {
          const contractValue = contractDetails?.value || 0;
          const existingInvoices = await this.repository.findAllByContractId(invoice.contract_id);
          const totalFinancing = existingInvoices.reduce(
            (sum, inv) =>
              sum + (inv.id === id ? newFinanceAmount : ((inv.details as any).value || 0) * 0.8),
            0
          );

          if (totalFinancing > contractValue) {
            throw new AppError(400, "CONTRACT_LIMIT_EXCEEDED", "Total financing exceeds contract value");
          }
        }
      }
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
    if (invoice.status === "APPROVED") {
      throw new AppError(400, "BAD_REQUEST", "Cannot delete an approved invoice");
    }

    // Restore capacity if not rejected and has contract
    if (invoice.contract_id && invoice.status !== "REJECTED") {
      const contract = await this.contractRepository.findById(invoice.contract_id);
      if (contract) {
        const contractDetails = contract.contract_details as any;
        const financeAmount = ((invoice.details as any).value || 0) * 0.8;

        await this.contractRepository.update(invoice.contract_id, {
          contract_details: {
            ...contractDetails,
            available_facility: (contractDetails.available_facility || 0) + financeAmount,
          },
        });
      }
    }

    await this.repository.delete(id);
  }

  async transitionInvoicesToSubmitted(applicationId: string): Promise<void> {
    const invoices = await this.repository.findByApplicationId(applicationId);
    const draftInvoiceIds = invoices
      .filter((inv) => inv.status === "DRAFT")
      .map((inv) => inv.id);

    if (draftInvoiceIds.length > 0) {
      await this.repository.updateManyStatus(draftInvoiceIds, "SUBMITTED");
    }
  }

  async approveInvoice(id: string): Promise<Invoice> {
    const invoice = await this.repository.findById(id);
    if (!invoice) {
      throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
    }

    if (invoice.status !== "SUBMITTED") {
      throw new AppError(400, "BAD_REQUEST", "Only SUBMITTED invoices can be approved");
    }

    const updatedInvoice = await this.repository.updateStatus(id, "APPROVED");

    // Update utilized_facility
    if (invoice.contract_id) {
      const contract = await this.contractRepository.findById(invoice.contract_id);
      if (contract) {
        const contractDetails = contract.contract_details as any;
        const invoiceValue = (invoice.details as any).value || 0;
        const financeAmount = invoiceValue * 0.8;

        const newUtilized = (contractDetails.utilized_facility || 0) + financeAmount;
        // available_facility remains the same as it was already decremented on creation/submission
        // Wait, if it wasn't decremented in the DB yet, we should update it here too to be safe?
        // But the user said it goes down when it is "made".

        await this.contractRepository.update(invoice.contract_id, {
          contract_details: {
            ...contractDetails,
            utilized_facility: newUtilized,
          },
        });
      }
    }

    return updatedInvoice;
  }

  async rejectInvoice(id: string): Promise<Invoice> {
    const invoice = await this.repository.findById(id);
    if (!invoice) {
      throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
    }

    if (invoice.status !== "SUBMITTED") {
      throw new AppError(400, "BAD_REQUEST", "Only SUBMITTED invoices can be rejected");
    }

    const updatedInvoice = await this.repository.updateStatus(id, "REJECTED");

    // If rejected, available_facility should go back up
    if (invoice.contract_id) {
      const contract = await this.contractRepository.findById(invoice.contract_id);
      if (contract) {
        const contractDetails = contract.contract_details as any;
        const invoiceValue = (invoice.details as any).value || 0;
        const financeAmount = invoiceValue * 0.8;

        const newAvailable = (contractDetails.available_facility || 0) + financeAmount;

        await this.contractRepository.update(invoice.contract_id, {
          contract_details: {
            ...contractDetails,
            available_facility: newAvailable,
          },
        });
      }
    }

    return updatedInvoice;
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
