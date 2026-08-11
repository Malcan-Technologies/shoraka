import { Request } from "express";
import { AppError } from "../../lib/http/error-handler";
import { extractRequestMetadata } from "../../lib/http/request-utils";
import { logger } from "../../lib/logger";
import {
  deleteS3Object,
  generateLegalDocumentKey,
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
  getFileExtension,
  validatePdfUpload,
} from "../../lib/s3/client";
import {
  assertStoredLegalPdf,
  isLegalDocumentS3Key,
  sanitizeS3KeyForLog,
} from "../../lib/s3/legal-document-object";
import { resolveActivePublishedByDocumentId } from "./active-published";
import { legalDocumentAuditLogService } from "./audit-log-service";
import { legalDocumentRepository, type VersionWithDocument } from "./repository";
import type {
  CreateLegalDocumentInput,
  CreateVersionInput,
  LegalDocumentAuditAction,
  ListLegalDocumentsQuery,
  PublishVersionInput,
  RequestVersionUploadUrlInput,
  ReplaceDraftFileInput,
  UpdateLegalDocumentInput,
  UpdateVersionInput,
} from "./schemas";
import type { LegalDocumentType } from "@cashsouk/types";

function toVersionSummary(version: {
  id: string;
  version: number;
  status: string;
  file_name: string;
  file_size: number;
  file_hash: string | null;
  reacceptance_required: boolean;
  uploaded_by: string;
  published_by: string | null;
  published_at: Date | null;
  archived_by: string | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: version.id,
    version: version.version,
    status: version.status,
    fileName: version.file_name,
    fileSize: version.file_size,
    fileHash: version.file_hash,
    reacceptanceRequired: version.reacceptance_required,
    uploadedBy: version.uploaded_by,
    publishedBy: version.published_by,
    publishedAt: version.published_at?.toISOString() ?? null,
    archivedBy: version.archived_by,
    archivedAt: version.archived_at?.toISOString() ?? null,
    createdAt: version.created_at.toISOString(),
    updatedAt: version.updated_at.toISOString(),
  };
}

function toDocumentResponse(doc: {
  id: string;
  type: string;
  title: string;
  description: string | null;
  audience: string;
  required_for_onboarding: boolean;
  public_visibility: boolean;
  show_in_account: boolean;
  created_at: Date;
  updated_at: Date;
  versions?: Array<Parameters<typeof toVersionSummary>[0]>;
}) {
  return {
    id: doc.id,
    type: doc.type,
    title: doc.title,
    description: doc.description,
    audience: doc.audience,
    requiredForOnboarding: doc.required_for_onboarding,
    publicVisibility: doc.public_visibility,
    showInAccount: doc.show_in_account,
    createdAt: doc.created_at.toISOString(),
    updatedAt: doc.updated_at.toISOString(),
    versions: (doc.versions ?? []).map(toVersionSummary),
  };
}

function toVersionResponse(version: VersionWithDocument) {
  return {
    ...toVersionSummary(version),
    legalDocumentId: version.legal_document_id,
    s3Key: version.s3_key,
    contentType: version.content_type,
    type: version.legal_document.type,
    title: version.legal_document.title,
    description: version.legal_document.description,
    audience: version.legal_document.audience,
    requiredForOnboarding: version.legal_document.required_for_onboarding,
    publicVisibility: version.legal_document.public_visibility,
    showInAccount: version.legal_document.show_in_account,
  };
}

export class LegalDocumentService {
  async listDocuments(query: ListLegalDocumentsQuery) {
    const { documents, total } = await legalDocumentRepository.findAll(query);
    return {
      documents: documents.map(toDocumentResponse),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalCount: total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async createDefinition(input: CreateLegalDocumentInput, adminUserId: string, req: Request) {
    const existing = await legalDocumentRepository.findByType(input.type);
    if (existing) {
      throw new AppError(
        409,
        "CONFLICT",
        `This legal document already exists. Upload a new version from the existing document instead.`
      );
    }

    const document = await legalDocumentRepository.create(input);

    await this.recordAuditEvent(req, adminUserId, "LEGAL_DOCUMENT_CREATED", {
      legalDocumentId: document.id,
      documentType: document.type as LegalDocumentType,
      afterJson: {
        title: document.title,
        description: document.description,
        audience: document.audience,
        required_for_onboarding: document.required_for_onboarding,
        public_visibility: document.public_visibility,
        show_in_account: document.show_in_account,
      },
    });

    logger.info({ legalDocumentId: document.id, type: document.type }, "Legal document created");
    return toDocumentResponse(document);
  }

  async updateDefinition(
    id: string,
    input: UpdateLegalDocumentInput,
    adminUserId: string,
    req: Request
  ) {
    const existing = await legalDocumentRepository.findById(id);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Legal document not found");
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (input.title !== undefined && input.title !== existing.title) {
      changes.title = { from: existing.title, to: input.title };
    }
    if (input.description !== undefined && input.description !== existing.description) {
      changes.description = { from: existing.description, to: input.description };
    }
    if (input.audience !== undefined && input.audience !== existing.audience) {
      changes.audience = { from: existing.audience, to: input.audience };
    }
    if (
      input.requiredForOnboarding !== undefined &&
      input.requiredForOnboarding !== existing.required_for_onboarding
    ) {
      changes.required_for_onboarding = {
        from: existing.required_for_onboarding,
        to: input.requiredForOnboarding,
      };
    }
    if (
      input.publicVisibility !== undefined &&
      input.publicVisibility !== existing.public_visibility
    ) {
      changes.public_visibility = {
        from: existing.public_visibility,
        to: input.publicVisibility,
      };
    }
    if (
      input.showInAccount !== undefined &&
      input.showInAccount !== existing.show_in_account
    ) {
      changes.show_in_account = {
        from: existing.show_in_account,
        to: input.showInAccount,
      };
    }

    if (Object.keys(changes).length === 0) {
      return toDocumentResponse(existing);
    }

    const updated = await legalDocumentRepository.update(id, input);

    const beforeJson: Record<string, unknown> = {};
    const afterJson: Record<string, unknown> = {};
    for (const [key, change] of Object.entries(changes)) {
      beforeJson[key] = change.from;
      afterJson[key] = change.to;
    }

    await this.recordAuditEvent(req, adminUserId, "LEGAL_DOCUMENT_UPDATED", {
      legalDocumentId: id,
      documentType: existing.type as LegalDocumentType,
      beforeJson,
      afterJson,
    });

    logger.info({ legalDocumentId: id, changes: Object.keys(changes) }, "Legal document updated");
    return toDocumentResponse(updated);
  }

  async requestVersionUploadUrl(
    legalDocumentId: string,
    input: RequestVersionUploadUrlInput,
    adminUserId: string
  ) {
    const document = await legalDocumentRepository.findById(legalDocumentId);
    if (!document) {
      throw new AppError(404, "NOT_FOUND", "Legal document not found");
    }

    const validation = validatePdfUpload({
      contentType: input.contentType,
      fileSize: input.fileSize,
    });
    if (!validation.valid) {
      throw new AppError(400, "VALIDATION_ERROR", validation.error!);
    }

    const extension = getFileExtension(input.fileName);
    if (extension !== "pdf") {
      throw new AppError(400, "VALIDATION_ERROR", "Only PDF files are allowed");
    }

    const latestVersion = await legalDocumentRepository.getLatestVersionNumber(legalDocumentId);
    const newVersion = latestVersion + 1;
    const s3Key = generateLegalDocumentKey({
      type: document.type,
      version: newVersion,
      cuid: this.generateCuid(),
      extension,
    });

    const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: input.contentType,
      contentLength: input.fileSize,
    });

    logger.info(
      { legalDocumentId, version: newVersion, adminUserId },
      "Generated legal document version upload URL"
    );

    return {
      uploadUrl,
      s3Key,
      expiresIn,
      version: newVersion,
    };
  }

  async createDraftVersion(
    legalDocumentId: string,
    input: CreateVersionInput,
    adminUserId: string,
    req: Request
  ) {
    const document = await legalDocumentRepository.findById(legalDocumentId);
    if (!document) {
      throw new AppError(404, "NOT_FOUND", "Legal document not found");
    }

    if (!isLegalDocumentS3Key(input.s3Key)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid S3 key for legal document");
    }

    let verified: { fileHash: string; fileSize: number };
    try {
      verified = await assertStoredLegalPdf({
        s3Key: input.s3Key,
        claimedFileSize: input.fileSize,
      });
    } catch (error) {
      await this.tryDeleteUnreferencedUpload(input.s3Key, "create-hash-or-validation-failed");
      throw error;
    }

    const latestVersion = await legalDocumentRepository.getLatestVersionNumber(legalDocumentId);
    const newVersion = latestVersion + 1;

    let version: VersionWithDocument;
    try {
      version = await legalDocumentRepository.createVersion(
        legalDocumentId,
        newVersion,
        {
          s3Key: input.s3Key,
          fileName: input.fileName,
          contentType: input.contentType,
          fileSize: verified.fileSize,
          fileHash: verified.fileHash,
        },
        adminUserId
      );
    } catch (error) {
      await this.tryDeleteUnreferencedUpload(input.s3Key, "create-db-failed");
      throw error;
    }

    await this.recordAuditEvent(req, adminUserId, "LEGAL_VERSION_UPLOADED", {
      legalDocumentId,
      legalDocumentVersionId: version.id,
      documentType: document.type as LegalDocumentType,
      versionNumber: version.version,
      documentHash: version.file_hash,
      afterJson: {
        version: version.version,
        file_name: version.file_name,
        file_hash: version.file_hash,
        status: version.status,
      },
    });

    logger.info(
      { legalDocumentId, versionId: version.id, version: version.version },
      "Legal document draft version created"
    );

    return toVersionResponse(version);
  }

  async updateDraftVersion(
    versionId: string,
    input: UpdateVersionInput,
    adminUserId: string,
    req: Request
  ) {
    const existing = await legalDocumentRepository.findVersionById(versionId);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Legal document version not found");
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(400, "INVALID_STATUS", "Only draft versions can be edited");
    }

    const updated = await legalDocumentRepository.updateDraftVersion(versionId, input);

    logger.info(
      {
        legalDocumentId: existing.legal_document_id,
        versionId,
        version: existing.version,
      },
      "Legal document draft version metadata checked"
    );

    return toVersionResponse(updated);
  }

  /**
   * Replace the PDF on an existing Draft in place.
   * Keeps the same version number — does not create a new legal version.
   */
  async requestDraftReplaceUploadUrl(
    versionId: string,
    input: RequestVersionUploadUrlInput,
    adminUserId: string
  ) {
    const existing = await legalDocumentRepository.findVersionById(versionId);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Legal document version not found");
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(
        400,
        "INVALID_STATUS",
        "Only draft versions can have their PDF replaced in place"
      );
    }

    const validation = validatePdfUpload({
      contentType: input.contentType,
      fileSize: input.fileSize,
    });
    if (!validation.valid) {
      throw new AppError(400, "VALIDATION_ERROR", validation.error!);
    }

    const extension = getFileExtension(input.fileName);
    if (extension !== "pdf") {
      throw new AppError(400, "VALIDATION_ERROR", "Only PDF files are allowed");
    }

    const s3Key = generateLegalDocumentKey({
      type: existing.legal_document.type,
      version: existing.version,
      cuid: this.generateCuid(),
      extension,
    });

    const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: input.contentType,
      contentLength: input.fileSize,
    });

    logger.info(
      {
        legalDocumentId: existing.legal_document_id,
        versionId,
        version: existing.version,
        adminUserId,
      },
      "Generated legal document draft replace upload URL"
    );

    return {
      uploadUrl,
      s3Key,
      expiresIn,
      version: existing.version,
    };
  }

  async replaceDraftFile(
    versionId: string,
    input: ReplaceDraftFileInput,
    adminUserId: string,
    req: Request
  ) {
    const existing = await legalDocumentRepository.findVersionById(versionId);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Legal document version not found");
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(
        400,
        "INVALID_STATUS",
        "Only draft versions can have their PDF replaced in place"
      );
    }
    if (!isLegalDocumentS3Key(input.s3Key)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid S3 key for legal document");
    }

    let verified: { fileHash: string; fileSize: number };
    try {
      verified = await assertStoredLegalPdf({
        s3Key: input.s3Key,
        claimedFileSize: input.fileSize,
      });
    } catch (error) {
      await this.tryDeleteUnreferencedUpload(input.s3Key, "replace-hash-or-validation-failed");
      throw error;
    }

    const oldKey = existing.s3_key;

    const updated = await legalDocumentRepository.replaceDraftFile(versionId, {
      s3Key: input.s3Key,
      fileName: input.fileName,
      contentType: input.contentType,
      fileSize: verified.fileSize,
      fileHash: verified.fileHash,
    });

    await this.safeDeleteReplacedDraftObject({
      oldKey,
      newKey: input.s3Key,
      versionId,
      versionStatus: existing.status,
    });

    await this.recordAuditEvent(req, adminUserId, "LEGAL_VERSION_FILE_REPLACED", {
      legalDocumentId: existing.legal_document_id,
      legalDocumentVersionId: versionId,
      documentType: existing.legal_document.type as LegalDocumentType,
      versionNumber: existing.version,
      documentHash: updated.file_hash,
      beforeJson: {
        file_name: existing.file_name,
        file_hash: existing.file_hash,
      },
      afterJson: {
        file_name: updated.file_name,
        file_hash: updated.file_hash,
      },
    });

    logger.info(
      {
        legalDocumentId: existing.legal_document_id,
        versionId,
        version: existing.version,
      },
      "Legal document draft PDF replaced in place"
    );

    return toVersionResponse(updated);
  }

  async publishVersion(
    versionId: string,
    input: PublishVersionInput,
    adminUserId: string,
    req: Request
  ) {
    const existing = await legalDocumentRepository.findVersionById(versionId);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Legal document version not found");
    }
    if (existing.status !== "DRAFT" && existing.status !== "ARCHIVED") {
      throw new AppError(400, "INVALID_STATUS", "Only draft or archived versions can be published");
    }
    if (!existing.file_hash) {
      throw new AppError(
        400,
        "HASH_REQUIRED",
        "Cannot publish a version without a server-generated file hash"
      );
    }

    const reacceptanceRequired = input.reacceptanceRequired ?? false;

    const previouslyPublished = await legalDocumentRepository.findAllPublishedByDocumentId(
      existing.legal_document_id,
      versionId
    );

    const published = await legalDocumentRepository.publishVersion(
      versionId,
      existing.legal_document_id,
      adminUserId,
      reacceptanceRequired
    );

    await this.recordAuditEvent(req, adminUserId, "LEGAL_VERSION_PUBLISHED", {
      legalDocumentId: existing.legal_document_id,
      legalDocumentVersionId: versionId,
      documentType: existing.legal_document.type as LegalDocumentType,
      versionNumber: published.version,
      documentHash: published.file_hash,
      beforeJson: {
        status: existing.status,
        reacceptance_required: existing.reacceptance_required,
      },
      afterJson: {
        status: "PUBLISHED",
        reacceptance_required: reacceptanceRequired,
        version: published.version,
        file_hash: published.file_hash,
      },
    });

    for (const archived of previouslyPublished) {
      await this.recordAuditEvent(req, adminUserId, "LEGAL_VERSION_ARCHIVED", {
        legalDocumentId: existing.legal_document_id,
        legalDocumentVersionId: archived.id,
        documentType: existing.legal_document.type as LegalDocumentType,
        versionNumber: archived.version,
        documentHash: archived.file_hash,
        beforeJson: { status: "PUBLISHED" },
        afterJson: { status: "ARCHIVED" },
        reason: "auto_archived_on_publish",
      });
    }

    logger.info(
      {
        versionId,
        legalDocumentId: existing.legal_document_id,
        reacceptanceRequired,
      },
      "Legal document version published"
    );

    return toVersionResponse(published);
  }

  async archiveVersion(versionId: string, adminUserId: string, req: Request) {
    const existing = await legalDocumentRepository.findVersionById(versionId);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Legal document version not found");
    }
    if (existing.status === "ARCHIVED") {
      return toVersionResponse(existing);
    }

    const archived = await legalDocumentRepository.archiveVersion(versionId, adminUserId);

    await this.recordAuditEvent(req, adminUserId, "LEGAL_VERSION_ARCHIVED", {
      legalDocumentId: existing.legal_document_id,
      legalDocumentVersionId: versionId,
      documentType: existing.legal_document.type as LegalDocumentType,
      versionNumber: archived.version,
      documentHash: archived.file_hash,
      beforeJson: { status: existing.status },
      afterJson: { status: "ARCHIVED" },
    });

    return toVersionResponse(archived);
  }

  /**
   * Restore an archived version:
   * - never-published archive → Draft (blocked if another draft exists)
   * - previously published archive → Published (blocked if a newer published version exists)
   */
  async restoreVersion(versionId: string, adminUserId: string, req: Request) {
    const existing = await legalDocumentRepository.findVersionById(versionId);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Legal document version not found");
    }
    if (existing.status !== "ARCHIVED") {
      throw new AppError(400, "INVALID_STATUS", "Only archived versions can be restored");
    }

    const wasPublished = Boolean(existing.published_at);

    if (wasPublished) {
      const currentPublished = await resolveActivePublishedByDocumentId(
        existing.legal_document_id
      );
      if (currentPublished && currentPublished.version > existing.version) {
        throw new AppError(
          409,
          "NEWER_PUBLISHED_EXISTS",
          "A newer published version already exists. Upload a new version instead."
        );
      }

      const previouslyPublished = await legalDocumentRepository.findAllPublishedByDocumentId(
        existing.legal_document_id,
        versionId
      );

      const published = await legalDocumentRepository.publishVersion(
        versionId,
        existing.legal_document_id,
        adminUserId,
        existing.reacceptance_required
      );

      for (const archived of previouslyPublished) {
        await this.recordAuditEvent(req, adminUserId, "LEGAL_VERSION_ARCHIVED", {
          legalDocumentId: existing.legal_document_id,
          legalDocumentVersionId: archived.id,
          documentType: existing.legal_document.type as LegalDocumentType,
          versionNumber: archived.version,
          documentHash: archived.file_hash,
          beforeJson: { status: "PUBLISHED" },
          afterJson: { status: "ARCHIVED" },
          reason: "auto_archived_on_restore_publish",
        });
      }

      await this.recordAuditEvent(req, adminUserId, "LEGAL_VERSION_RESTORED", {
        legalDocumentId: existing.legal_document_id,
        legalDocumentVersionId: versionId,
        documentType: existing.legal_document.type as LegalDocumentType,
        versionNumber: published.version,
        documentHash: published.file_hash,
        beforeJson: { status: "ARCHIVED" },
        afterJson: { status: "PUBLISHED", restored_as: "PUBLISHED" },
      });

      return toVersionResponse(published);
    }

    const currentDraft = await legalDocumentRepository.findDraftByDocumentId(
      existing.legal_document_id
    );
    if (currentDraft) {
      throw new AppError(
        409,
        "DRAFT_EXISTS",
        "Another draft already exists for this legal document."
      );
    }

    const restored = await legalDocumentRepository.restoreVersionToDraft(versionId);

    await this.recordAuditEvent(req, adminUserId, "LEGAL_VERSION_RESTORED", {
      legalDocumentId: existing.legal_document_id,
      legalDocumentVersionId: versionId,
      documentType: existing.legal_document.type as LegalDocumentType,
      versionNumber: restored.version,
      documentHash: restored.file_hash,
      beforeJson: { status: "ARCHIVED" },
      afterJson: { status: "DRAFT", restored_as: "DRAFT" },
    });

    return toVersionResponse(restored);
  }

  async getAdminDownloadUrl(versionId: string) {
    const version = await legalDocumentRepository.findVersionById(versionId);
    if (!version) {
      throw new AppError(404, "NOT_FOUND", "Legal document version not found");
    }

    const { downloadUrl, expiresIn } = await generatePresignedDownloadUrl({
      key: version.s3_key,
      fileName: version.file_name,
    });

    return {
      downloadUrl,
      expiresIn,
      fileName: version.file_name,
      contentType: version.content_type,
      fileSize: version.file_size,
    };
  }

  /**
   * After a successful draft DB update to a new key, delete the previous object
   * when it is safe. Deletion failure must not roll back the DB update.
   */
  private async safeDeleteReplacedDraftObject(params: {
    oldKey: string;
    newKey: string;
    versionId: string;
    versionStatus: string;
  }): Promise<void> {
    const { oldKey, newKey, versionId, versionStatus } = params;

    if (oldKey === newKey) return;
    if (versionStatus !== "DRAFT") return;
    if (!isLegalDocumentS3Key(oldKey)) {
      logger.warn(
        { keyPreview: sanitizeS3KeyForLog(oldKey), versionId },
        "Skipped draft S3 cleanup: old key outside legal-documents prefix"
      );
      return;
    }

    const otherRefs = await legalDocumentRepository.countVersionsByS3Key(oldKey, versionId);
    if (otherRefs > 0) {
      logger.warn(
        { keyPreview: sanitizeS3KeyForLog(oldKey), versionId, otherRefs },
        "Skipped draft S3 cleanup: key still referenced by another version"
      );
      return;
    }

    try {
      await deleteS3Object(oldKey);
      logger.info(
        { keyPreview: sanitizeS3KeyForLog(oldKey), versionId },
        "Deleted replaced legal-document draft S3 object"
      );
    } catch (error) {
      logger.warn(
        {
          keyPreview: sanitizeS3KeyForLog(oldKey),
          versionId,
          errName: error instanceof Error ? error.name : "unknown",
        },
        "LEGAL_DOCUMENT_DRAFT_S3_CLEANUP_FAILED: DB points to new object; old draft object may be orphaned"
      );
    }
  }

  /** Best-effort delete of an upload that never became a DB reference. */
  private async tryDeleteUnreferencedUpload(s3Key: string, reason: string): Promise<void> {
    if (!isLegalDocumentS3Key(s3Key)) return;
    const refs = await legalDocumentRepository.countVersionsByS3Key(s3Key);
    if (refs > 0) return;
    try {
      await deleteS3Object(s3Key);
      logger.info(
        { keyPreview: sanitizeS3KeyForLog(s3Key), reason },
        "Deleted unreferenced legal-document upload after failed create/replace"
      );
    } catch (error) {
      logger.warn(
        {
          keyPreview: sanitizeS3KeyForLog(s3Key),
          reason,
          errName: error instanceof Error ? error.name : "unknown",
        },
        "LEGAL_DOCUMENT_UPLOAD_ORPHAN_CLEANUP_FAILED"
      );
    }
  }

  private async recordAuditEvent(
    req: Request,
    actorUserId: string,
    action: LegalDocumentAuditAction,
    params: {
      legalDocumentId?: string | null;
      legalDocumentVersionId?: string | null;
      documentType?: LegalDocumentType | null;
      versionNumber?: number | null;
      documentHash?: string | null;
      beforeJson?: Record<string, unknown> | null;
      afterJson?: Record<string, unknown> | null;
      reason?: string | null;
    }
  ) {
    const { ipAddress, userAgent, deviceInfo } = extractRequestMetadata(req);
    logger.info(
      {
        userId: actorUserId,
        documentId: params.legalDocumentId,
        eventType: action,
        ipAddress,
        userAgent,
        deviceInfo,
        ...params,
      },
      `Legal document event: ${action}`
    );

    await legalDocumentAuditLogService.record({
      req,
      action,
      actorUserId,
      legalDocumentId: params.legalDocumentId,
      legalDocumentVersionId: params.legalDocumentVersionId,
      documentType: params.documentType,
      versionNumber: params.versionNumber,
      documentHash: params.documentHash,
      beforeJson: params.beforeJson,
      afterJson: params.afterJson,
      reason: params.reason,
    });
  }

  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}${random}`;
  }
}

export const legalDocumentService = new LegalDocumentService();
