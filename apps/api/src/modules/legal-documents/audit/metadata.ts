import { z } from "zod";
import { legalDocumentTypes } from "../schemas";
import {
  LEGAL_ADMIN_ARCHIVE_REASON,
  LEGAL_ADMIN_AUDIT_EVENTS,
  type LegalAdminAuditEventType,
} from "./events";

const documentTypeSchema = z.enum(legalDocumentTypes);
const versionStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const actorSnapshotSchema = {
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
};

export const legalDocumentCreatedAuditMetadataSchema = z.object({
  ...actorSnapshotSchema,
  documentType: documentTypeSchema,
  title: z.string(),
  description: z.string().nullable().optional(),
  audience: z.enum(["PUBLIC", "ISSUER", "INVESTOR", "BOTH"]),
  requiredForOnboarding: z.boolean(),
  publicVisibility: z.boolean(),
  showInAccount: z.boolean(),
});

export const legalDocumentUpdatedAuditMetadataSchema = z.object({
  ...actorSnapshotSchema,
  documentType: documentTypeSchema,
  changedFields: z.array(z.string()).min(1),
  before: z.record(z.unknown()),
  after: z.record(z.unknown()),
});

export const legalDocumentVersionUploadedAuditMetadataSchema = z.object({
  ...actorSnapshotSchema,
  documentType: documentTypeSchema,
  versionId: z.string().min(1),
  versionNumber: z.number().int(),
  fileName: z.string().min(1),
  fileHash: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().int(),
  status: z.literal("DRAFT"),
});

export const legalDocumentVersionFileReplacedAuditMetadataSchema = z.object({
  ...actorSnapshotSchema,
  documentType: documentTypeSchema,
  versionId: z.string().min(1),
  versionNumber: z.number().int(),
  previousFileName: z.string().min(1),
  previousFileHash: z.string().nullable(),
  previousMimeType: z.string().min(1).optional(),
  previousFileSizeBytes: z.number().int().optional(),
  fileName: z.string().min(1),
  fileHash: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().int(),
});

export const legalDocumentVersionPublishedAuditMetadataSchema = z.object({
  ...actorSnapshotSchema,
  documentType: documentTypeSchema,
  versionId: z.string().min(1),
  versionNumber: z.number().int(),
  fileName: z.string().min(1),
  fileHash: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().int(),
  previousStatus: versionStatusSchema,
  newStatus: z.literal("PUBLISHED"),
  previousReacceptanceRequired: z.boolean(),
  reacceptanceRequired: z.boolean(),
});

export const legalDocumentVersionArchivedAuditMetadataSchema = z.object({
  ...actorSnapshotSchema,
  documentType: documentTypeSchema,
  versionId: z.string().min(1),
  versionNumber: z.number().int(),
  fileName: z.string().min(1).optional(),
  fileHash: z.string().nullable().optional(),
  mimeType: z.string().min(1).optional(),
  fileSizeBytes: z.number().int().optional(),
  previousStatus: versionStatusSchema,
  newStatus: z.literal("ARCHIVED"),
  reasonCode: z
    .enum([
      LEGAL_ADMIN_ARCHIVE_REASON.AUTO_ARCHIVED_ON_PUBLISH,
      LEGAL_ADMIN_ARCHIVE_REASON.AUTO_ARCHIVED_ON_RESTORE_PUBLISH,
    ])
    .optional(),
});

export const legalDocumentVersionRestoredAuditMetadataSchema = z.object({
  ...actorSnapshotSchema,
  documentType: documentTypeSchema,
  versionId: z.string().min(1),
  versionNumber: z.number().int(),
  fileName: z.string().min(1),
  fileHash: z.string().nullable(),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().int(),
  previousStatus: z.literal("ARCHIVED"),
  newStatus: z.enum(["DRAFT", "PUBLISHED"]),
  restoredAs: z.enum(["DRAFT", "PUBLISHED"]),
  reacceptanceRequired: z.boolean().optional(),
});

export const legalDocumentVersionCreatedFromVersionAuditMetadataSchema = z.object({
  ...actorSnapshotSchema,
  documentType: documentTypeSchema,
  sourceVersionId: z.string().min(1),
  sourceVersionNumber: z.number().int(),
  newVersionId: z.string().min(1),
  newVersionNumber: z.number().int(),
  fileName: z.string().min(1),
  fileHash: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().int(),
  status: z.literal("DRAFT"),
  sourceVersionStatus: z.enum(["PUBLISHED", "ARCHIVED"]).optional(),
});

const metadataByEvent = {
  LEGAL_DOCUMENT_CREATED: legalDocumentCreatedAuditMetadataSchema,
  LEGAL_DOCUMENT_UPDATED: legalDocumentUpdatedAuditMetadataSchema,
  LEGAL_DOCUMENT_VERSION_UPLOADED: legalDocumentVersionUploadedAuditMetadataSchema,
  LEGAL_DOCUMENT_VERSION_FILE_REPLACED: legalDocumentVersionFileReplacedAuditMetadataSchema,
  LEGAL_DOCUMENT_VERSION_PUBLISHED: legalDocumentVersionPublishedAuditMetadataSchema,
  LEGAL_DOCUMENT_VERSION_ARCHIVED: legalDocumentVersionArchivedAuditMetadataSchema,
  LEGAL_DOCUMENT_VERSION_RESTORED: legalDocumentVersionRestoredAuditMetadataSchema,
  LEGAL_DOCUMENT_VERSION_CREATED_FROM_VERSION:
    legalDocumentVersionCreatedFromVersionAuditMetadataSchema,
} as const;

export function parseLegalAdminAuditMetadata(
  eventType: LegalAdminAuditEventType,
  metadata: unknown
): Record<string, unknown> {
  const schema = metadataByEvent[eventType];
  return schema.parse(metadata);
}

export function isLegalAdminAuditEventType(value: string): value is LegalAdminAuditEventType {
  return (LEGAL_ADMIN_AUDIT_EVENTS as readonly string[]).includes(value);
}
