import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import {
  copyS3Object,
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
import type { LegalAdminAuditContext } from "./audit/context";
import { LEGAL_ADMIN_ARCHIVE_REASON } from "./audit/events";
import {
  writeLegalDocumentCreatedAudit,
  writeLegalDocumentUpdatedAudit,
  writeLegalDocumentVersionArchivedAudit,
  writeLegalDocumentVersionFileReplacedAudit,
  writeLegalDocumentVersionCreatedFromVersionAudit,
  writeLegalDocumentVersionPublishedAudit,
  writeLegalDocumentVersionRestoredAudit,
  writeLegalDocumentVersionUploadedAudit,
} from "./audit/writer";
import { legalDocumentRepository, type VersionWithDocument } from "./repository";
import type {
  CreateLegalDocumentInput,
  CreateVersionInput,
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

  async createDefinition(input: CreateLegalDocumentInput, context: LegalAdminAuditContext) {
    const existing = await legalDocumentRepository.findByType(input.type);
    if (existing) {
      throw new AppError(
        409,
        "CONFLICT",
        `This legal document already exists. Upload a new version from the existing document instead.`
      );
    }

    const document = await prisma.$transaction(async (tx) => {
      const created = await legalDocumentRepository.create(input, tx);
      await writeLegalDocumentCreatedAudit(tx, created, context);
      return created;
    });

    logger.info({ legalDocumentId: document.id, type: document.type }, "Legal document created");
    return toDocumentResponse(document);
  }

  async updateDefinition(
    id: string,
    input: UpdateLegalDocumentInput,
    context: LegalAdminAuditContext
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
      changes.requiredForOnboarding = {
        from: existing.required_for_onboarding,
        to: input.requiredForOnboarding,
      };
    }
    if (
      input.publicVisibility !== undefined &&
      input.publicVisibility !== existing.public_visibility
    ) {
      changes.publicVisibility = {
        from: existing.public_visibility,
        to: input.publicVisibility,
      };
    }
    if (
      input.showInAccount !== undefined &&
      input.showInAccount !== existing.show_in_account
    ) {
      changes.showInAccount = {
        from: existing.show_in_account,
        to: input.showInAccount,
      };
    }

    if (Object.keys(changes).length === 0) {
      return toDocumentResponse(existing);
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [key, change] of Object.entries(changes)) {
      before[key] = change.from;
      after[key] = change.to;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await legalDocumentRepository.update(id, input, tx);
      await writeLegalDocumentUpdatedAudit(
        tx,
        existing,
        Object.keys(changes),
        before,
        after,
        context
      );
      return next;
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
    context: LegalAdminAuditContext
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
      version = await prisma.$transaction(async (tx) => {
        const created = await legalDocumentRepository.createVersion(
          legalDocumentId,
          newVersion,
          {
            s3Key: input.s3Key,
            fileName: input.fileName,
            contentType: input.contentType,
            fileSize: verified.fileSize,
            fileHash: verified.fileHash,
          },
          adminUserId,
          tx
        );
        await writeLegalDocumentVersionUploadedAudit(tx, created, context);
        return created;
      });
    } catch (error) {
      await this.tryDeleteUnreferencedUpload(input.s3Key, "create-db-failed");
      throw error;
    }

    logger.info(
      { legalDocumentId, versionId: version.id, version: version.version },
      "Legal document draft version created"
    );

    return toVersionResponse(version);
  }

  async updateDraftVersion(versionId: string, input: UpdateVersionInput) {
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
    context: LegalAdminAuditContext
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

    const updated = await prisma.$transaction(async (tx) => {
      const next = await legalDocumentRepository.replaceDraftFile(
        versionId,
        {
          s3Key: input.s3Key,
          fileName: input.fileName,
          contentType: input.contentType,
          fileSize: verified.fileSize,
          fileHash: verified.fileHash,
        },
        tx
      );
      await writeLegalDocumentVersionFileReplacedAudit(tx, existing, next, context);
      return next;
    });

    await this.safeDeleteReplacedDraftObject({
      oldKey,
      newKey: input.s3Key,
      versionId,
      versionStatus: existing.status,
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
    context: LegalAdminAuditContext
  ) {
    const existing = await legalDocumentRepository.findVersionById(versionId);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Legal document version not found");
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(400, "INVALID_STATUS", "Only draft versions can be published");
    }
    if (!existing.file_hash) {
      throw new AppError(
        400,
        "HASH_REQUIRED",
        "Cannot publish a version without a server-generated file hash"
      );
    }

    const reacceptanceRequired = input.reacceptanceRequired ?? false;
    const documentType = existing.legal_document.type as LegalDocumentType;

    const published = await prisma.$transaction(async (tx) => {
      const previouslyPublished = await legalDocumentRepository.findAllPublishedByDocumentId(
        existing.legal_document_id,
        versionId,
        tx
      );

      const next = await legalDocumentRepository.publishVersion(
        versionId,
        existing.legal_document_id,
        adminUserId,
        reacceptanceRequired,
        tx
      );

      await writeLegalDocumentVersionPublishedAudit(tx, existing, next, context);

      for (const archived of previouslyPublished) {
        await writeLegalDocumentVersionArchivedAudit(
          tx,
          {
            legalDocumentId: existing.legal_document_id,
            documentType,
            version: archived,
            previousStatus: "PUBLISHED",
            reasonCode: LEGAL_ADMIN_ARCHIVE_REASON.AUTO_ARCHIVED_ON_PUBLISH,
          },
          context
        );
      }

      return next;
    });

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

  async archiveVersion(versionId: string, adminUserId: string, context: LegalAdminAuditContext) {
    const existing = await legalDocumentRepository.findVersionById(versionId);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Legal document version not found");
    }
    if (existing.status === "ARCHIVED") {
      return toVersionResponse(existing);
    }

    const archived = await prisma.$transaction(async (tx) => {
      const next = await legalDocumentRepository.archiveVersion(versionId, adminUserId, tx);
      await writeLegalDocumentVersionArchivedAudit(
        tx,
        {
          legalDocumentId: existing.legal_document_id,
          documentType: existing.legal_document.type as LegalDocumentType,
          version: next,
          previousStatus: existing.status,
        },
        context
      );
      return next;
    });

    return toVersionResponse(archived);
  }

  /**
   * Restore an archived version:
   * - never-published archive → Draft (blocked if another draft exists)
   * - previously published archive → immutable; use createVersionFromArchivedPublished
   */
  async restoreVersion(versionId: string, adminUserId: string, context: LegalAdminAuditContext) {
    const existing = await legalDocumentRepository.findVersionById(versionId);
    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Legal document version not found");
    }
    if (existing.status !== "ARCHIVED") {
      throw new AppError(400, "INVALID_STATUS", "Only archived versions can be restored");
    }

    if (existing.published_at) {
      throw new AppError(
        409,
        "VERSION_IMMUTABLE",
        "Previously published versions cannot be restored. Create a new version from this version instead."
      );
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

    const restored = await prisma.$transaction(async (tx) => {
      const next = await legalDocumentRepository.restoreVersionToDraft(versionId, tx);
      await writeLegalDocumentVersionRestoredAudit(tx, next, "DRAFT", context);
      return next;
    });

    return toVersionResponse(restored);
  }

  /**
   * Copy an archived previously-published version into a new DRAFT row.
   * Source version, timestamps, publishers, and acceptances are left untouched.
   */
  async createVersionFromArchivedPublished(
    sourceVersionId: string,
    adminUserId: string,
    context: LegalAdminAuditContext
  ) {
    const source = await legalDocumentRepository.findVersionById(sourceVersionId);
    if (!source) {
      throw new AppError(404, "NOT_FOUND", "Legal document version not found");
    }
    if (source.status !== "ARCHIVED" || !source.published_at) {
      throw new AppError(
        400,
        "INVALID_STATUS",
        "Only previously published archived versions can be used to create a new version"
      );
    }
    if (!source.file_hash) {
      throw new AppError(
        400,
        "HASH_REQUIRED",
        "Source version is missing a server-generated file hash"
      );
    }
    if (!isLegalDocumentS3Key(source.s3_key)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid S3 key for legal document");
    }

    const currentDraft = await legalDocumentRepository.findDraftByDocumentId(
      source.legal_document_id
    );
    if (currentDraft) {
      throw new AppError(
        409,
        "DRAFT_EXISTS",
        "Another draft already exists for this legal document."
      );
    }

    const latestVersion = await legalDocumentRepository.getLatestVersionNumber(
      source.legal_document_id
    );
    const newVersionNumber = latestVersion + 1;
    const extension = getFileExtension(source.file_name) || "pdf";
    const destKey = generateLegalDocumentKey({
      type: source.legal_document.type,
      version: newVersionNumber,
      cuid: this.generateCuid(),
      extension,
    });

    if (!isLegalDocumentS3Key(destKey)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid S3 key for legal document");
    }

    try {
      await copyS3Object({ sourceKey: source.s3_key, destinationKey: destKey });
    } catch (error) {
      logger.warn(
        {
          sourceKeyPreview: sanitizeS3KeyForLog(source.s3_key),
          destKeyPreview: sanitizeS3KeyForLog(destKey),
          errName: error instanceof Error ? error.name : "unknown",
        },
        "Legal document S3 copy failed"
      );
      throw new AppError(502, "S3_COPY_FAILED", "Could not copy the source document file");
    }

    let verified: { fileHash: string; fileSize: number };
    try {
      verified = await assertStoredLegalPdf({
        s3Key: destKey,
        claimedFileSize: source.file_size,
      });
    } catch (error) {
      await this.tryDeleteUnreferencedUpload(destKey, "clone-hash-or-validation-failed");
      throw error;
    }

    if (verified.fileHash !== source.file_hash) {
      await this.tryDeleteUnreferencedUpload(destKey, "clone-hash-mismatch");
      throw new AppError(
        400,
        "HASH_MISMATCH",
        "Copied file hash does not match the source version"
      );
    }

    let created: VersionWithDocument;
    try {
      created = await prisma.$transaction(async (tx) => {
        const row = await legalDocumentRepository.createVersion(
          source.legal_document_id,
          newVersionNumber,
          {
            s3Key: destKey,
            fileName: source.file_name,
            contentType: source.content_type,
            fileSize: verified.fileSize,
            fileHash: verified.fileHash,
          },
          adminUserId,
          tx
        );
        await writeLegalDocumentVersionCreatedFromVersionAudit(tx, source, row, context);
        return row;
      });
    } catch (error) {
      await this.tryDeleteUnreferencedUpload(destKey, "clone-db-failed");
      throw error;
    }

    logger.info(
      {
        sourceVersionId,
        newVersionId: created.id,
        newVersionNumber,
        legalDocumentId: source.legal_document_id,
      },
      "Legal document version created from archived published version"
    );

    return toVersionResponse(created);
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

  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}${random}`;
  }
}

export const legalDocumentService = new LegalDocumentService();
