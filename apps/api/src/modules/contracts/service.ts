import { ContractRepository } from "./repository";
import { ApplicationRepository } from "../applications/repository";
import { OrganizationRepository } from "../organization/repository";
import { AppError } from "../../lib/http/error-handler";
import { Contract, Prisma, ContractStatus } from "@prisma/client";
import {
  generateContractDocumentKey,
  generatePresignedUploadUrl,
  getFileExtension,
  validateDocument,
} from "../../lib/s3/client";
import { logger } from "../../lib/logger";

export class ContractService {
  private repository: ContractRepository;
  private applicationRepository: ApplicationRepository;
  private organizationRepository: OrganizationRepository;

  constructor() {
    this.repository = new ContractRepository();
    this.applicationRepository = new ApplicationRepository();
    this.organizationRepository = new OrganizationRepository();
  }

  private async verifyContractAccess(contractId: string, userId: string): Promise<Contract> {
    const contract = await this.repository.findById(contractId);
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

  private async verifyApplicationAccess(applicationId: string, userId: string): Promise<any> {
    const application = await this.applicationRepository.findById(applicationId);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const organizationId = application.issuer_organization_id;
    const organization = (application as any).issuer_organization;

    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
    }

    if (organization.owner_user_id === userId) {
      return application;
    }

    const member = await this.organizationRepository.getOrganizationMember(
      organizationId,
      userId,
      "issuer"
    );

    if (!member) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to this application.");
    }

    return application;
  }

  async createContract(applicationId: string, userId: string): Promise<Contract> {
    const application = await this.verifyApplicationAccess(applicationId, userId);

    // Check if contract already exists for this application
    const existingContract = await this.repository.findByApplicationId(applicationId);
    if (existingContract) {
      return existingContract;
    }

    return this.repository.create({
      application_id: applicationId,
      issuer_organization_id: application.issuer_organization_id,
      status: "DRAFT",
    });
  }

  async getContract(id: string, userId: string): Promise<Contract> {
    return this.verifyContractAccess(id, userId);
  }

  async updateContract(id: string, data: Prisma.ContractUpdateInput, userId: string): Promise<Contract> {
    await this.verifyContractAccess(id, userId);
    return this.repository.update(id, {
      ...data,
      updated_at: new Date(),
    });
  }

  async getApprovedContracts(userId: string, organizationId: string): Promise<Contract[]> {
    // Basic verification: user must belong to the organization
    const member = await this.organizationRepository.getOrganizationMember(
      organizationId,
      userId,
      "issuer"
    );

    // Also check if user is owner
    const organization = await this.organizationRepository.findById(organizationId);

    if (!member && organization?.owner_user_id !== userId) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to this organization's contracts.");
    }

    return this.repository.findApprovedByOrganization(organizationId);
  }

  private generateCuid(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  async requestUploadUrl(params: {
    contractId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    type: "contract" | "consent";
    userId: string;
  }): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number }> {
    await this.verifyContractAccess(params.contractId, params.userId);

    const validation = validateDocument({
      contentType: params.contentType,
      fileSize: params.fileSize,
    });

    if (!validation.valid) {
      throw new AppError(400, "VALIDATION_ERROR", validation.error || "Invalid file");
    }

    const extension = getFileExtension(params.fileName) || "pdf";
    const cuid = this.generateCuid();

    // Type-specific logic could be added here if needed, but for now they share the same key pattern
    const s3Key = generateContractDocumentKey({
      contractId: params.contractId,
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

export const contractService = new ContractService();
