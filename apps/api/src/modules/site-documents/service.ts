import { Request } from "express";
import type { SiteDocumentType } from "./schemas";
import { AppError } from "../../lib/http/error-handler";
import { extractRequestMetadata, getDeviceInfo } from "../../lib/http/request-utils";
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  generateSiteDocumentKey,
  getFileExtension,
  validateSiteDocument,
} from "../../lib/s3/client";
import {
  siteDocumentRepository,
  documentLogRepository,
  type CreateSiteDocumentData,
  type UpdateSiteDocumentData,
} from "./repository";
import type {
  RequestUploadUrlInput,
  CreateDocumentInput,
  UpdateDocumentInput,
  RequestReplaceUploadUrlInput,
  ConfirmReplaceInput,
  ListDocumentsQuery,
  GetDocumentLogsQuery,
  DocumentEventType,
  ExportDocumentLogsQuery,
} from "./schemas";
import { logger } from "../../lib/logger";

export class SiteDocumentService {
  async requestUploadUrl(input: RequestUploadUrlInput, adminUserId: string) {
    const validation = validateSiteDocument({
      contentType: input.contentType,
      fileSize: input.fileSize,
    });

    if (!validation.valid) {
      throw new AppError(400, "VALIDATION_ERROR", validation.error!);
    }

    if (input.contentType !== "application/pdf") {
      throw new AppError(400, "VALIDATION_ERROR", "Only PDF uploads are allowed");
    }

    const extension = getFileExtension(input.fileName);
    if (extension.toLowerCase() !== "pdf") {
      throw new AppError(400, "VALIDATION_ERROR", "Only PDF uploads are allowed");
    }

    const cuid = this.generateCuid();
    const latestVersion = await siteDocumentRepository.getLatestVersionByType(input.type);
    const newVersion = latestVersion + 1;

    const s3Key = generateSiteDocumentKey({
      type: input.type,
      version: newVersion,
      cuid,
      extension,
    });

    const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: input.contentType,
      contentLength: input.fileSize,
    });

    logger.info(
      { type: input.type, s3Key, adminUserId, version: newVersion },
      "Generated presigned upload URL for new document draft"
    );

    return {
      uploadUrl,
      s3Key,
      expiresIn,
      version: newVersion,
    };
  }

  async createDocument(input: CreateDocumentInput, adminUserId: string, req: Request) {
    if (input.contentType !== "application/pdf") {
      throw new AppError(400, "VALIDATION_ERROR", "Only PDF uploads are allowed");
    }

    const latestVersion = await siteDocumentRepository.getLatestVersionByType(input.type);
    const version = latestVersion + 1;

    const data: CreateSiteDocumentData = {
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      fileName: input.fileName,
      s3Key: input.s3Key,
      contentType: input.contentType,
      fileSize: input.fileSize,
      fileHash: input.fileHash ?? null,
      showInAccount: input.showInAccount ?? false,
      uploadedBy: adminUserId,
      version,
      audience: input.audience,
      acceptanceRequired: input.acceptanceRequired,
      openBeforeAcceptRequired: input.openBeforeAcceptRequired,
      reacceptanceRequired: input.reacceptanceRequired,
      effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
      status: "DRAFT",
    };

    const document = await siteDocumentRepository.create(data);

    await this.logDocumentEvent(req, adminUserId, document.id, "DOCUMENT_CREATED", {
      title: document.title,
      type: document.type,
      file_name: document.file_name,
      file_size: document.file_size,
      file_hash: document.file_hash,
      version: document.version,
      audience: document.audience,
      status: document.status,
      acceptance_required: document.acceptance_required,
      show_in_account: document.show_in_account,
    });

    logger.info(
      { documentId: document.id, type: document.type, status: document.status },
      "Site document draft created"
    );

    return document;
  }

  async listDocuments(query: ListDocumentsQuery) {
    const { documents, total } = await siteDocumentRepository.findAll({
      page: query.page,
      pageSize: query.pageSize,
      type: query.type,
      status: query.status,
      audience: query.audience,
      includeInactive: query.includeInactive,
      search: query.search,
    });

    return {
      documents,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getDocumentById(id: string) {
    const document = await siteDocumentRepository.findById(id);
    if (!document) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }
    return document;
  }

  async updateDocument(id: string, input: UpdateDocumentInput, adminUserId: string, req: Request) {
    const existing = await siteDocumentRepository.findById(id);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    if (existing.status === "ARCHIVED") {
      throw new AppError(400, "ARCHIVED", "Archived documents cannot be edited");
    }

    const data: UpdateSiteDocumentData = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (input.title !== undefined && input.title !== existing.title) {
      data.title = input.title;
      changes.title = { from: existing.title, to: input.title };
    }

    if (input.description !== undefined && input.description !== existing.description) {
      data.description = input.description;
      changes.description = { from: existing.description, to: input.description };
    }

    if (input.showInAccount !== undefined && input.showInAccount !== existing.show_in_account) {
      data.showInAccount = input.showInAccount;
      changes.show_in_account = { from: existing.show_in_account, to: input.showInAccount };
    }

    if (input.audience !== undefined && input.audience !== existing.audience) {
      data.audience = input.audience;
      changes.audience = { from: existing.audience, to: input.audience };
    }

    if (
      input.acceptanceRequired !== undefined &&
      input.acceptanceRequired !== existing.acceptance_required
    ) {
      data.acceptanceRequired = input.acceptanceRequired;
      changes.acceptance_required = {
        from: existing.acceptance_required,
        to: input.acceptanceRequired,
      };
    }

    if (
      input.openBeforeAcceptRequired !== undefined &&
      input.openBeforeAcceptRequired !== existing.open_before_accept_required
    ) {
      data.openBeforeAcceptRequired = input.openBeforeAcceptRequired;
      changes.open_before_accept_required = {
        from: existing.open_before_accept_required,
        to: input.openBeforeAcceptRequired,
      };
    }

    if (
      input.reacceptanceRequired !== undefined &&
      input.reacceptanceRequired !== existing.reacceptance_required
    ) {
      data.reacceptanceRequired = input.reacceptanceRequired;
      changes.reacceptance_required = {
        from: existing.reacceptance_required,
        to: input.reacceptanceRequired,
      };
    }

    if (input.effectiveDate !== undefined) {
      const nextDate = input.effectiveDate ? new Date(input.effectiveDate) : null;
      data.effectiveDate = nextDate;
      changes.effective_date = {
        from: existing.effective_date,
        to: nextDate,
      };
    }

    if (Object.keys(data).length === 0) {
      return existing;
    }

    const updated = await siteDocumentRepository.update(id, data);

    await this.logDocumentEvent(req, adminUserId, id, "DOCUMENT_UPDATED", {
      document_id: id,
      title: existing.title,
      type: existing.type,
      changes,
    });

    logger.info({ documentId: id, changes: Object.keys(changes) }, "Site document updated");

    return updated;
  }

  async publishDocument(
    id: string,
    adminUserId: string,
    req: Request,
    reacceptanceRequired = false
  ) {
    const existing = await siteDocumentRepository.findById(id);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    if (existing.status === "PUBLISHED") {
      return existing;
    }

    if (existing.status === "ARCHIVED") {
      throw new AppError(400, "ARCHIVED", "Archived documents cannot be published");
    }

    const published = await siteDocumentRepository.publish(
      id,
      adminUserId,
      reacceptanceRequired
    );
    if (!published) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    // Never reset tnc_accepted. Pending re-acceptance is calculated separately.

    await this.logDocumentEvent(req, adminUserId, id, "DOCUMENT_PUBLISHED", {
      document_id: id,
      title: published.title,
      type: published.type,
      version: published.version,
      audience: published.audience,
      file_hash: published.file_hash,
      acceptance_required: published.acceptance_required,
      reacceptance_required: published.reacceptance_required,
    });

    logger.info(
      {
        documentId: id,
        type: published.type,
        version: published.version,
        reacceptanceRequired: published.reacceptance_required,
      },
      "Site document published"
    );

    return published;
  }

  async archiveDocument(id: string, adminUserId: string, req: Request) {
    const existing = await siteDocumentRepository.findById(id);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    if (existing.status === "ARCHIVED") {
      return existing;
    }

    const archived = await siteDocumentRepository.archive(id, adminUserId);

    await this.logDocumentEvent(req, adminUserId, id, "DOCUMENT_ARCHIVED", {
      document_id: id,
      title: archived.title,
      type: archived.type,
      version: archived.version,
      previous_status: existing.status,
    });

    logger.info({ documentId: id }, "Site document archived");

    return archived;
  }

  /**
   * Upload a new draft version based on an existing document.
   * Previous file versions remain in S3 and in the database for audit.
   */
  async requestReplaceUrl(
    id: string,
    input: RequestReplaceUploadUrlInput,
    adminUserId: string
  ) {
    const existing = await siteDocumentRepository.findById(id);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    const validation = validateSiteDocument({
      contentType: input.contentType,
      fileSize: input.fileSize,
    });

    if (!validation.valid) {
      throw new AppError(400, "VALIDATION_ERROR", validation.error!);
    }

    if (input.contentType !== "application/pdf") {
      throw new AppError(400, "VALIDATION_ERROR", "Only PDF uploads are allowed");
    }

    const extension = getFileExtension(input.fileName);
    if (extension.toLowerCase() !== "pdf") {
      throw new AppError(400, "VALIDATION_ERROR", "Only PDF uploads are allowed");
    }

    const cuid = this.generateCuid();
    const latestVersion = await siteDocumentRepository.getLatestVersionByType(existing.type);
    const newVersion = latestVersion + 1;

    const s3Key = generateSiteDocumentKey({
      type: existing.type,
      version: newVersion,
      cuid,
      extension,
    });

    const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: input.contentType,
      contentLength: input.fileSize,
    });

    logger.info(
      { documentId: id, newVersion, s3Key, adminUserId },
      "Generated presigned upload URL for new draft version"
    );

    return {
      uploadUrl,
      s3Key,
      expiresIn,
      previousVersion: existing.version,
      newVersion,
      type: existing.type,
      title: existing.title,
      audience: existing.audience,
    };
  }

  async confirmReplace(
    id: string,
    input: ConfirmReplaceInput,
    adminUserId: string,
    req: Request
  ) {
    const existing = await siteDocumentRepository.findById(id);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    const latestVersion = await siteDocumentRepository.getLatestVersionByType(existing.type);
    const newVersion = latestVersion + 1;

    const created = await siteDocumentRepository.create({
      type: existing.type,
      title: existing.title,
      description: existing.description,
      fileName: input.fileName,
      s3Key: input.s3Key,
      contentType: "application/pdf",
      fileSize: input.fileSize,
      fileHash: input.fileHash ?? null,
      showInAccount: existing.show_in_account,
      uploadedBy: adminUserId,
      version: newVersion,
      audience: existing.audience,
      acceptanceRequired: existing.acceptance_required,
      openBeforeAcceptRequired: existing.open_before_accept_required,
      reacceptanceRequired: existing.reacceptance_required,
      effectiveDate: null,
      status: "DRAFT",
    });

    await this.logDocumentEvent(req, adminUserId, created.id, "DOCUMENT_CREATED", {
      document_id: created.id,
      previous_document_id: id,
      title: created.title,
      type: created.type,
      previous_version: existing.version,
      new_version: newVersion,
      file_name: input.fileName,
      file_size: input.fileSize,
      file_hash: input.fileHash ?? null,
      status: "DRAFT",
    });

    logger.info(
      { previousDocumentId: id, documentId: created.id, newVersion },
      "New draft document version created (previous version retained)"
    );

    return created;
  }

  async deleteDocument(id: string, adminUserId: string, req: Request) {
    return this.archiveDocument(id, adminUserId, req);
  }

  async restoreDocument(id: string, adminUserId: string, req: Request) {
    const existing = await siteDocumentRepository.findById(id);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    if (existing.status !== "ARCHIVED") {
      throw new AppError(400, "NOT_ARCHIVED", "Document is not archived");
    }

    const updated = await siteDocumentRepository.restore(id);

    await this.logDocumentEvent(req, adminUserId, id, "DOCUMENT_RESTORED", {
      document_id: id,
      title: existing.title,
      type: existing.type,
      status: updated.status,
    });

    logger.info({ documentId: id }, "Site document restored to draft");

    return updated;
  }

  async listActiveDocuments() {
    return siteDocumentRepository.findAllActive();
  }

  async listAccountDocuments() {
    return siteDocumentRepository.findActiveForAccount();
  }

  async getActiveDocumentByType(type: SiteDocumentType) {
    const document = await siteDocumentRepository.findActiveByType(type);
    if (!document) {
      throw new AppError(404, "NOT_FOUND", `No active document of type ${type}`);
    }
    return document;
  }

  async getDownloadUrl(id: string) {
    const document = await siteDocumentRepository.findById(id);
    if (!document) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    if (document.status !== "PUBLISHED" || !document.is_active) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    const { downloadUrl, expiresIn } = await generatePresignedDownloadUrl({
      key: document.s3_key,
      fileName: document.file_name,
    });

    return {
      downloadUrl,
      expiresIn,
      fileName: document.file_name,
      contentType: document.content_type,
      fileSize: document.file_size,
    };
  }

  async getAdminDownloadUrl(id: string) {
    const document = await siteDocumentRepository.findById(id);
    if (!document) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    const { downloadUrl, expiresIn } = await generatePresignedDownloadUrl({
      key: document.s3_key,
      fileName: document.file_name,
    });

    return {
      downloadUrl,
      expiresIn,
      fileName: document.file_name,
      contentType: document.content_type,
      fileSize: document.file_size,
    };
  }

  async getDocumentLogs(query: GetDocumentLogsQuery) {
    const { logs, total } = await documentLogRepository.findAll(query);

    return {
      logs,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async exportDocumentLogs(query: Omit<ExportDocumentLogsQuery, "format">) {
    return documentLogRepository.findForExport({
      search: query.search,
      eventType: query.eventType,
      eventTypes: query.eventTypes,
      dateRange: query.dateRange,
    });
  }

  private async logDocumentEvent(
    req: Request,
    userId: string,
    documentId: string | null,
    eventType: DocumentEventType,
    metadata: Record<string, unknown>
  ) {
    const { ipAddress, userAgent } = extractRequestMetadata(req);
    const deviceInfo = getDeviceInfo(req);

    await documentLogRepository.create({
      userId,
      documentId,
      eventType,
      ipAddress,
      userAgent,
      deviceInfo,
      metadata,
    });
  }

  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}${random}`;
  }
}

export const siteDocumentService = new SiteDocumentService();
