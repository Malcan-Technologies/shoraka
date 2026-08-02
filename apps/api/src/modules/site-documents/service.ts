import { Request } from "express";
import type { SiteDocumentType } from "./schemas";
import { AppError } from "../../lib/http/error-handler";
import { getDeviceInfo } from "../../lib/http/request-utils";
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  generateSiteDocumentKey,
  getFileExtension,
  validateSiteDocument,
  deleteS3Object,
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
  /**
   * Request a presigned URL for uploading a new document
   */
  async requestUploadUrl(input: RequestUploadUrlInput, adminUserId: string) {
    // Validate file
    const validation = validateSiteDocument({
      contentType: input.contentType,
      fileSize: input.fileSize,
    });

    if (!validation.valid) {
      throw new AppError(400, "VALIDATION_ERROR", validation.error!);
    }

    // Generate unique S3 key
    const extension = getFileExtension(input.fileName);
    const cuid = this.generateCuid();
    const latestVersion = await siteDocumentRepository.getLatestVersionByType(input.type);
    const newVersion = latestVersion + 1;

    const s3Key = generateSiteDocumentKey({
      type: input.type,
      version: newVersion,
      cuid,
      extension,
    });

    // Generate presigned upload URL
    const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: input.contentType,
      contentLength: input.fileSize,
    });

    logger.info(
      { type: input.type, s3Key, adminUserId },
      "Generated presigned upload URL for new document"
    );

    return {
      uploadUrl,
      s3Key,
      expiresIn,
      version: newVersion,
    };
  }

  /**
   * Create document record after successful upload
   */
  async createDocument(input: CreateDocumentInput, adminUserId: string, req: Request) {
    // Create the document
    const data: CreateSiteDocumentData = {
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      fileName: input.fileName,
      s3Key: input.s3Key,
      contentType: input.contentType,
      fileSize: input.fileSize,
      showInAccount: input.showInAccount ?? false,
      uploadedBy: adminUserId,
    };

    const document = await siteDocumentRepository.create(data);

    // Log the creation
    await this.logDocumentEvent(req, adminUserId, document.id, "DOCUMENT_CREATED", {
      title: document.title,
      type: document.type,
      file_name: document.file_name,
      file_size: document.file_size,
      version: document.version,
      show_in_account: document.show_in_account,
    });

    logger.info({ documentId: document.id, type: document.type }, "Site document created");

    return document;
  }

  /**
   * List documents (admin view, includes inactive)
   */
  async listDocuments(query: ListDocumentsQuery) {
    const { documents, total } = await siteDocumentRepository.findAll({
      page: query.page,
      pageSize: query.pageSize,
      type: query.type,
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

  /**
   * Get document by ID
   */
  async getDocumentById(id: string) {
    const document = await siteDocumentRepository.findById(id);
    if (!document) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }
    return document;
  }

  /**
   * Update document metadata
   */
  async updateDocument(id: string, input: UpdateDocumentInput, adminUserId: string, req: Request) {
    const existing = await siteDocumentRepository.findById(id);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
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

    if (Object.keys(data).length === 0) {
      return existing; // No changes
    }

    const updated = await siteDocumentRepository.update(id, data);

    // Log the update
    await this.logDocumentEvent(req, adminUserId, id, "DOCUMENT_UPDATED", {
      document_id: id,
      title: existing.title,
      type: existing.type,
      changes,
    });

    logger.info({ documentId: id, changes: Object.keys(changes) }, "Site document updated");

    return updated;
  }

  /**
   * Request presigned URL for replacing document file
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

    // Validate file
    const validation = validateSiteDocument({
      contentType: input.contentType,
      fileSize: input.fileSize,
    });

    if (!validation.valid) {
      throw new AppError(400, "VALIDATION_ERROR", validation.error!);
    }

    // Generate new S3 key with incremented version
    const extension = getFileExtension(input.fileName);
    const cuid = this.generateCuid();
    const newVersion = existing.version + 1;

    const s3Key = generateSiteDocumentKey({
      type: existing.type,
      version: newVersion,
      cuid,
      extension,
    });

    // Generate presigned upload URL
    const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: input.contentType,
      contentLength: input.fileSize,
    });

    logger.info(
      { documentId: id, newVersion, s3Key, adminUserId },
      "Generated presigned upload URL for document replacement"
    );

    return {
      uploadUrl,
      s3Key,
      expiresIn,
      previousVersion: existing.version,
      newVersion,
    };
  }

  /**
   * Confirm document file replacement
   */
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

    const previousS3Key = existing.s3_key;
    const previousVersion = existing.version;
    const newVersion = existing.version + 1;

    // Update the document record
    const updated = await siteDocumentRepository.replaceFile(id, {
      s3Key: input.s3Key,
      fileName: input.fileName,
      fileSize: input.fileSize,
      newVersion,
    });

    // Log the replacement
    await this.logDocumentEvent(req, adminUserId, id, "DOCUMENT_REPLACED", {
      document_id: id,
      title: existing.title,
      type: existing.type,
      previous_version: previousVersion,
      new_version: newVersion,
      file_name: input.fileName,
      file_size: input.fileSize,
    });

    // Delete old file from S3 (best effort, don't fail if this errors)
    try {
      await deleteS3Object(previousS3Key);
      logger.info({ s3Key: previousS3Key }, "Deleted old document file from S3");
    } catch (error) {
      logger.warn({ s3Key: previousS3Key, error }, "Failed to delete old document file from S3");
    }

    logger.info(
      { documentId: id, previousVersion, newVersion },
      "Site document file replaced"
    );

    return updated;
  }

  /**
   * Soft delete document
   */
  async deleteDocument(id: string, adminUserId: string, req: Request) {
    const existing = await siteDocumentRepository.findById(id);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    if (!existing.is_active) {
      throw new AppError(400, "ALREADY_DELETED", "Document is already deleted");
    }

    const updated = await siteDocumentRepository.softDelete(id);

    // Log the deletion
    await this.logDocumentEvent(req, adminUserId, id, "DOCUMENT_DELETED", {
      document_id: id,
      title: existing.title,
      type: existing.type,
    });

    logger.info({ documentId: id }, "Site document soft deleted");

    return updated;
  }

  /**
   * Restore soft-deleted document
   */
  async restoreDocument(id: string, adminUserId: string, req: Request) {
    const existing = await siteDocumentRepository.findById(id);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    if (existing.is_active) {
      throw new AppError(400, "NOT_DELETED", "Document is not deleted");
    }

    const updated = await siteDocumentRepository.restore(id);

    // Log the restoration
    await this.logDocumentEvent(req, adminUserId, id, "DOCUMENT_RESTORED", {
      document_id: id,
      title: existing.title,
      type: existing.type,
    });

    logger.info({ documentId: id }, "Site document restored");

    return updated;
  }

  // ========== User-facing methods ==========

  /**
   * List active documents (user view)
   */
  async listActiveDocuments() {
    return siteDocumentRepository.findAllActive();
  }

  /**
   * List documents for account page (show_in_account = true)
   */
  async listAccountDocuments() {
    return siteDocumentRepository.findActiveForAccount();
  }

  /**
   * Get active document by type
   */
  async getActiveDocumentByType(type: SiteDocumentType) {
    const document = await siteDocumentRepository.findActiveByType(type);
    if (!document) {
      throw new AppError(404, "NOT_FOUND", `No active document of type ${type}`);
    }
    return document;
  }

  /**
   * Get presigned download URL for document (user - active documents only)
   */
  async getDownloadUrl(id: string) {
    const document = await siteDocumentRepository.findById(id);
    if (!document) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    if (!document.is_active) {
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

  /**
   * Get presigned download URL for document (admin - includes archived documents)
   */
  async getAdminDownloadUrl(id: string) {
    const document = await siteDocumentRepository.findById(id);
    if (!document) {
      throw new AppError(404, "NOT_FOUND", "Document not found");
    }

    const doc = document as unknown as {
      s3_key: string;
      file_name: string;
      content_type: string;
      file_size: number;
    };
    
    // Admin can download any document, including archived ones
    const { downloadUrl, expiresIn } = await generatePresignedDownloadUrl({
      key: doc.s3_key,
      fileName: doc.file_name,
    });

    return {
      downloadUrl,
      expiresIn,
      fileName: doc.file_name,
      contentType: doc.content_type,
      fileSize: doc.file_size,
    };
  }

  // ========== Document Logs ==========

  /**
   * Get document logs with pagination and filters
   */
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

  /**
   * Export document logs
   */
  async exportDocumentLogs(query: Omit<ExportDocumentLogsQuery, 'format'>) {
    return documentLogRepository.findForExport({
      search: query.search,
      eventType: query.eventType,
      eventTypes: query.eventTypes,
      dateRange: query.dateRange,
    });
  }

  // ========== Private helpers ==========

  private async logDocumentEvent(
    req: Request,
    userId: string,
    documentId: string | null,
    eventType: DocumentEventType,
    metadata: Record<string, unknown>
  ) {
    const deviceInfo = getDeviceInfo(req);
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      null;

    await documentLogRepository.create({
      userId,
      documentId,
      eventType,
      ipAddress,
      userAgent: req.headers["user-agent"] ?? null,
      deviceInfo,
      metadata,
    });
  }

  private generateCuid(): string {
    // Simple cuid-like generator for S3 keys
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}${random}`;
  }
}

export const siteDocumentService = new SiteDocumentService();

