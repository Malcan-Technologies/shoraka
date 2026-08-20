import { InvoiceRepository } from "./repository";
import { ApplicationRepository } from "../applications/repository";
import { OrganizationRepository } from "../organization/repository";
import { ContractRepository } from "../contracts/repository";
import { AppError } from "../../lib/http/error-handler";
import { Invoice, Prisma } from "@prisma/client";
import { ApplicationStatus, ContractStatus, InvoiceStatus, WithdrawReason } from "@cashsouk/types";
import { computeApplicationStatus } from "../applications/lifecycle";
import { prisma } from "../../lib/prisma";
import {
  APPLICATION_AUDIT_TARGET_TYPE,
  issuerApplicationAuditContext,
  writeApplicationAuditLog,
} from "../applications/audit/writer";
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
import {
  allocateDisplayReference,
  resolveApplicationProductCode,
} from "../../lib/display-reference";
import { refreshContractFacilityValues } from "../../lib/refresh-contract-facility";

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

  private facilityContractIds(...ids: Array<string | null | undefined>): string[] {
    return [...new Set(ids.filter((id): id is string => Boolean(id)))];
  }

  private async refreshLinkedContractFacilities(
    ...ids: Array<string | null | undefined>
  ): Promise<void> {
    for (const contractId of this.facilityContractIds(...ids)) {
      await refreshContractFacilityValues(contractId);
    }
  }

  private async loadWorkflowForApplication(applicationId: string): Promise<unknown | null> {
    const app = await this.applicationRepository.findById(applicationId);
    const productId = (app?.financing_type as { product_id?: string } | null)?.product_id;
    if (!productId) return null;
    const productVersion = (app as { product_version?: number | null } | null)?.product_version;
    const product =
      productVersion != null
        ? await this.productRepository.findByBaseAndVersion(productId, productVersion)
        : await this.productRepository.findById(productId);
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

  async createInvoice(applicationId: string, contractId: string | undefined, details: any, userId: string): Promise<Invoice> {
    await this.verifyApplicationAccess(applicationId, userId);

    const workflow = await this.loadWorkflowForApplication(applicationId);
    if (workflow) {
      assertMaturityForApplication(workflow, details as Record<string, unknown>);
    }

    const s3Key = details?.document?.s3_key;

    try {
      const { prisma } = await import("../../lib/prisma");
      return await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<
          { financing_structure: Prisma.JsonValue | null }[]
        >`SELECT financing_structure FROM applications WHERE id = ${applicationId} FOR UPDATE`;
        const lockedApplication = locked[0];
        const structureType = (
          lockedApplication?.financing_structure as { structure_type?: string } | null
        )?.structure_type;

        if (structureType === "invoice_only") {
          const existingInvoiceCount = await tx.invoice.count({
            where: { application_id: applicationId },
          });
          if (existingInvoiceCount >= 1) {
            throw new AppError(
              400,
              "MAX_INVOICES_REACHED",
              "Invoice-only applications allow only one invoice."
            );
          }
        }

        const applicationRow = await tx.application.findUnique({
          where: { id: applicationId },
          select: {
            id: true,
            financing_type: true,
            product_version: true,
          },
        });
        if (!applicationRow) {
          throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
        }

        const productCode = await resolveApplicationProductCode(tx, {
          id: applicationRow.id,
          financing_type: applicationRow.financing_type,
          product_version: applicationRow.product_version,
        });
        if (!productCode) {
          throw new AppError(
            422,
            "PRODUCT_CODE_REQUIRED",
            "Application product code is missing. Configure product code before creating an invoice."
          );
        }

        const created = await tx.invoice.create({
          data: {
            application_id: applicationId,
            contract_id: contractId,
            details,
          },
        });

        await allocateDisplayReference(
          {
            moduleCode: "INV",
            productCode,
            referenceDate: created.created_at,
            entityType: "invoice",
            entityId: created.id,
            tx,
          },
          async (persistTx, reference) => {
            await persistTx.invoice.update({
              where: { id: created.id },
              data: { display_reference: reference },
            });
          }
        );

        return tx.invoice.findUniqueOrThrow({
          where: { id: created.id },
        });
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

    await this.refreshLinkedContractFacilities(
      invoice.contract_id,
      updatedInvoice.contract_id,
      (applicationRow as { contract_id?: string | null } | null)?.contract_id
    );

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

  const previousContractId =
    invoice.contract_id ??
    (application as { contract_id?: string | null } | null)?.contract_id ??
    null;

  // delete DB first OR last — your choice
  await this.repository.delete(id);
  await this.refreshLinkedContractFacilities(previousContractId);

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
    } catch {
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
    const previousStatus = invoice.status;
    const applicationId = invoice.application_id;

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.WITHDRAWN,
          withdraw_reason: finalReason,
        },
      });

      if (!applicationId) {
        return next;
      }

      const details = invoice.details as Record<string, unknown> | null;
      const invoiceNumber = details?.number != null ? String(details.number) : undefined;

      await writeApplicationAuditLog(
        {
          eventType: "INVOICE_WITHDRAWN",
          context: issuerApplicationAuditContext(userId),
          applicationId,
          targetType: APPLICATION_AUDIT_TARGET_TYPE.INVOICE,
          targetId: id,
          metadata: {
            previousStatus,
            newStatus: "WITHDRAWN",
            withdrawReason: finalReason,
            ...(invoiceNumber ? { invoiceNumber } : {}),
          },
        },
        tx
      );

      const allInvoices = await tx.invoice.findMany({ where: { application_id: applicationId } });
      const app = await tx.application.findUnique({
        where: { id: applicationId },
        select: { status: true, contract_id: true, financing_structure: true },
      });
      const contract = app?.contract_id
        ? await tx.contract.findUnique({ where: { id: app.contract_id }, select: { status: true } })
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
        await tx.application.update({
          where: { id: applicationId },
          data: { status: ApplicationStatus.WITHDRAWN },
        });
        await writeApplicationAuditLog(
          {
            eventType: "APPLICATION_WITHDRAWN",
            context: issuerApplicationAuditContext(userId),
            applicationId,
            targetType: APPLICATION_AUDIT_TARGET_TYPE.APPLICATION,
            targetId: applicationId,
            metadata: {
              previousStatus: currentStatus,
              newStatus: "WITHDRAWN",
              withdrawReason: finalReason,
            },
          },
          tx
        );
      }

      return next;
    });

    await this.refreshLinkedContractFacilities(
      invoice.contract_id,
      (invoice as { application?: { contract_id?: string | null } }).application?.contract_id
    );

    return updated;
  }
}

export const invoiceService = new InvoiceService();
