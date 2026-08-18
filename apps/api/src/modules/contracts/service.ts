import { ContractRepository } from "./repository";
import { ApplicationRepository } from "../applications/repository";
import { OrganizationRepository } from "../organization/repository";
import { AppError } from "../../lib/http/error-handler";
import { ApplicationReviewRemark, Contract, Prisma } from "@prisma/client";
import {
  ApplicationStatus,
  ContractStatus,
  WithdrawReason,
  parseScopeKey,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import {
  APPLICATION_AUDIT_TARGET_TYPE,
  issuerApplicationAuditContext,
  writeApplicationAuditLog,
} from "../applications/audit/writer";
import {
  generateContractDocumentKey,
  generateContractDocumentKeyWithVersion,
  generatePresignedUploadUrl,
  getFileExtension,
  validateDocument,
  deleteS3Object,
} from "../../lib/s3/client";
import { logger } from "../../lib/logger";
import {
  allocateDisplayReference,
  resolveApplicationProductCode,
} from "../../lib/display-reference";

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
      throw new AppError(404, "CONTRACT_NOT_FOUND", "Facility not found");
    }

    const organizationId = contract.issuer_organization_id;
    const organization = (contract as any).issuer_organization;

    if (!organization) {
      throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found for this facility");
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
      throw new AppError(403, "FORBIDDEN", "You do not have access to this facility.");
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
    await this.verifyApplicationAccess(applicationId, userId);

    // Check if contract already exists for this application
    const existingContract = await this.repository.findByApplicationId(applicationId);
    if (existingContract) {
      return existingContract;
    }

    return prisma.$transaction(async (tx) => {
      const lockedApplication = await tx.application.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          issuer_organization_id: true,
          contract_id: true,
          financing_type: true,
          product_version: true,
        },
      });
      if (!lockedApplication) {
        throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
      }

      if (lockedApplication.contract_id) {
        return tx.contract.findUniqueOrThrow({
          where: { id: lockedApplication.contract_id },
        });
      }

      const productCode = await resolveApplicationProductCode(tx, {
        id: lockedApplication.id,
        financing_type: lockedApplication.financing_type,
        product_version: lockedApplication.product_version,
      });
      if (!productCode) {
        throw new AppError(
          422,
          "PRODUCT_CODE_REQUIRED",
          "Application product code is missing. Configure product code before creating a contract."
        );
      }

      const created = await tx.contract.create({
        data: {
          issuer_organization_id: lockedApplication.issuer_organization_id,
          status: "DRAFT",
        },
      });

      await allocateDisplayReference(
        {
          moduleCode: "CON",
          productCode,
          referenceDate: created.created_at,
          entityType: "contract",
          entityId: created.id,
          tx,
        },
        async (persistTx, reference) => {
          await persistTx.contract.update({
            where: { id: created.id },
            data: { display_reference: reference },
          });
        }
      );

      await tx.application.update({
        where: { id: applicationId },
        data: { contract: { connect: { id: created.id } } },
      });

      return tx.contract.findUniqueOrThrow({
        where: { id: created.id },
      });
    });
  }

  async getContract(id: string, userId: string): Promise<Contract> {
    return this.verifyContractAccess(id, userId);
  }

  async updateContract(id: string, data: Prisma.ContractUpdateInput, userId: string): Promise<Contract> {
    const contract = await this.verifyContractAccess(id, userId);

    /** invoice_only: allow customer_details only; reject contract_details updates. */
    /** Enforce amendment boundaries: if application is in AMENDMENT_REQUESTED, contract edits
     * are only allowed if there is an active REQUEST_AMENDMENT remark for contract_details. */
    const applicationId = (contract as any)?.applications?.[0]?.id;
    if (applicationId) {
      const application = await this.applicationRepository.findById(applicationId);
      const structure = application?.financing_structure as { structure_type?: string } | null;
      if (structure?.structure_type === "invoice_only") {
        const isClearingContractDetails = data.contract_details === Prisma.JsonNull || data.contract_details === null;
        if (!isClearingContractDetails && data.contract_details != null) {
          throw new AppError(400, "VALIDATION_ERROR", "Facility financing fields are not allowed for invoice-only structure.");
        }
      }
      if (application && (application as any).status === "AMENDMENT_REQUESTED") {
        const remarks = await prisma.applicationReviewRemark.findMany({
          where: { application_id: applicationId, action_type: "REQUEST_AMENDMENT" } as any,
        });
        const hasContractRemark = remarks.some((r: ApplicationReviewRemark) => {
          try {
            const p = parseScopeKey(r.scope_key);
            return (p.kind === "TAB" && p.tab === "contract_details") || (p.kind === "FIELD" && p.tab === "contract_details");
          } catch {
            return false;
          }
        });
        if (!hasContractRemark) {
          throw new AppError(403, "AMENDMENT_BOUNDARY", "Facility edits are locked during amendment unless facility details are requested for amendment.");
        }
      }
    }

    const extractS3Key = (obj: unknown): string | null => {
      const d = (obj as Record<string, unknown>)?.document as Record<string, unknown> | undefined;
      const k = d?.s3_key;
      return typeof k === "string" && k ? k : null;
    };

    const prevContractKey = extractS3Key(contract.contract_details);
    const prevCustomerKey = extractS3Key(contract.customer_details);
    const nextContractKey = data.contract_details != null ? extractS3Key(data.contract_details) : null;
    const nextCustomerKey = data.customer_details != null ? extractS3Key(data.customer_details) : null;

    const keysToCleanup: string[] = [];
    if (nextContractKey && nextContractKey !== prevContractKey) keysToCleanup.push(nextContractKey);
    if (nextCustomerKey && nextCustomerKey !== prevCustomerKey) keysToCleanup.push(nextCustomerKey);

    try {
      return await this.repository.update(id, {
        ...data,
        updated_at: new Date(),
      });
    } catch (err) {
      for (const key of keysToCleanup) {
        try {
          await deleteS3Object(key);
          logger.info({ contractId: id, s3Key: key }, "Deleted orphan contract document after update failure");
        } catch (delErr) {
          logger.warn({ contractId: id, s3Key: key, err: delErr }, "Cleanup: failed to delete orphan contract document");
        }
      }
      throw err;
    }
  }

  async unlinkContract(applicationId: string, userId: string): Promise<void> {
    const application = await this.verifyApplicationAccess(applicationId, userId);
    if (!application.contract_id) return;

    return this.repository.unlinkFromApplication(applicationId);
  }

  async getApprovedContracts(userId: string, organizationId: string): Promise<Contract[]> {
    // Basic verification: user must belong to the organization
    const member = await this.organizationRepository.getOrganizationMember(
      organizationId,
      userId,
      "issuer"
    );

    // Also check if user is owner
    const organization = await this.organizationRepository.findIssuerOrganizationById(organizationId);

    if (!member && organization?.owner_user_id !== userId) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to this organization's facilities.");
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
    existingS3Key?: string;
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
    let s3Key: string;

    // If existingS3Key is provided, increment version and reuse the same cuid
    if (params.existingS3Key) {
      const versionedKey = generateContractDocumentKeyWithVersion({
        existingS3Key: params.existingS3Key,
        extension,
      });
      
      if (!versionedKey) {
        throw new AppError(400, "INVALID_S3_KEY", "Failed to parse existing S3 key for versioning");
      }
      
      s3Key = versionedKey;
    } else {
      // Generate new key with version 1
      const cuid = this.generateCuid();
      s3Key = generateContractDocumentKey({
        contractId: params.contractId,
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

  private async anyLinkedApplicationPreservesContractDocuments(contractId: string): Promise<boolean> {
    const row = await prisma.application.findFirst({
      where: { contract_id: contractId, status: ApplicationStatus.AMENDMENT_REQUESTED },
      select: { id: true },
    });
    return row != null;
  }

  async deleteDocument(contractId: string, s3Key: string, userId: string): Promise<void> {
    await this.verifyContractAccess(contractId, userId);

    if (await this.anyLinkedApplicationPreservesContractDocuments(contractId)) {
      logger.info(
        { contractId, s3Key },
        "Skipped contract document S3 delete: linked application AMENDMENT_REQUESTED (preserve for compare/audit)"
      );
      return;
    }

    try {
      await deleteS3Object(s3Key);
    } catch {
      throw new AppError(500, "DELETE_FAILED", "Failed to delete document from S3");
    }
  }

  async withdrawContract(id: string, userId: string, reason?: WithdrawReason): Promise<Contract> {
    const contract = await this.verifyContractAccess(id, userId);

    if (contract.status === ContractStatus.APPROVED) {
      throw new AppError(400, "BAD_REQUEST", "This facility has already been approved and can no longer be withdrawn.");
    }

    if (contract.status === ContractStatus.WITHDRAWN) {
      throw new AppError(400, "BAD_REQUEST", "This facility was already withdrawn.");
    }

    const finalReason = reason ?? WithdrawReason.USER_CANCELLED;
    const previousStatus = contract.status;
    const applications = (contract as { applications?: { id: string }[] }).applications ?? [];

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.contract.update({
        where: { id },
        data: {
          status: ContractStatus.WITHDRAWN,
          withdraw_reason: finalReason,
        },
      });

      for (const app of applications) {
        await tx.application.update({
          where: { id: app.id },
          data: { status: "WITHDRAWN" },
        });
        await tx.applicationReview.upsert({
          where: {
            application_id_section: {
              application_id: app.id,
              section: "contract_details",
            },
          },
          create: {
            application_id: app.id,
            section: "contract_details",
            status: "WITHDRAWN",
            reviewer_user_id: userId,
            reviewed_at: new Date(),
          },
          update: {
            status: "WITHDRAWN",
            reviewer_user_id: userId,
            reviewed_at: new Date(),
          },
        });
        await writeApplicationAuditLog(
          {
            eventType: "CONTRACT_WITHDRAWN",
            context: issuerApplicationAuditContext(userId),
            applicationId: app.id,
            targetType: APPLICATION_AUDIT_TARGET_TYPE.CONTRACT,
            targetId: id,
            metadata: {
              previousStatus,
              newStatus: "WITHDRAWN",
              withdrawReason: finalReason,
            },
          },
          tx
        );
        await writeApplicationAuditLog(
          {
            eventType: "APPLICATION_WITHDRAWN",
            context: issuerApplicationAuditContext(userId),
            applicationId: app.id,
            targetType: APPLICATION_AUDIT_TARGET_TYPE.APPLICATION,
            targetId: app.id,
            metadata: {
              newStatus: "WITHDRAWN",
              withdrawReason: finalReason,
            },
          },
          tx
        );
      }

      return next;
    });

    return updated;
  }
}

export const contractService = new ContractService();
