import type { Prisma } from "@prisma/client";
import type { LegalDocumentType } from "@cashsouk/types";
import {
  LEGAL_ADMIN_AUDIT_TARGET_TYPE,
  type LegalAdminArchiveReasonCode,
  type LegalAdminAuditEventType,
  type LegalAdminAuditTargetType,
} from "./events";
import type { LegalAdminAuditContext } from "./context";
import { parseLegalAdminAuditMetadata } from "./metadata";
import type { LegalDocumentRow, VersionWithDocument } from "../repository";

export type LegalAdminAuditWriteInput = {
  legalDocumentId: string;
  legalDocumentVersionId?: string | null;
  eventType: LegalAdminAuditEventType;
  targetType: LegalAdminAuditTargetType;
  targetId: string;
  context: LegalAdminAuditContext;
  metadata: Record<string, unknown>;
  occurredAt?: Date;
};

async function loadActorSnapshot(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<{ name: string | null; email: string | null }> {
  const user = await tx.user.findUnique({
    where: { user_id: userId },
    select: { email: true, first_name: true, last_name: true },
  });
  if (!user) return { name: null, email: null };
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return { name: name || null, email: user.email };
}

export async function writeLegalAdminAuditLog(
  tx: Prisma.TransactionClient,
  input: LegalAdminAuditWriteInput
): Promise<void> {
  if (!input.context.actorUserId) {
    throw new Error("Legal admin audit write requires actorUserId.");
  }

  const actor = await loadActorSnapshot(tx, input.context.actorUserId);
  const metadata = parseLegalAdminAuditMetadata(input.eventType, {
    ...input.metadata,
    actorName: actor.name,
    actorEmail: actor.email,
  });

  await tx.legalAdminAuditLog.create({
    data: {
      legal_document_id: input.legalDocumentId,
      legal_document_version_id: input.legalDocumentVersionId ?? null,
      event_type: input.eventType,
      actor_type: input.context.actorType,
      actor_user_id: input.context.actorUserId,
      organization_id: input.context.organizationId,
      organization_kind: input.context.organizationKind,
      target_type: input.targetType,
      target_id: input.targetId,
      source: input.context.source,
      portal: input.context.portal,
      ip_address: input.context.ipAddress ?? null,
      user_agent: input.context.userAgent ?? null,
      correlation_id: input.context.correlationId ?? null,
      idempotency_key: input.context.idempotencyKey ?? null,
      metadata: JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue,
      ...(input.occurredAt ? { occurred_at: input.occurredAt } : {}),
    },
  });
}

function documentTypeOf(doc: { type: string }): LegalDocumentType {
  return doc.type as LegalDocumentType;
}

export async function writeLegalDocumentCreatedAudit(
  tx: Prisma.TransactionClient,
  document: LegalDocumentRow,
  context: LegalAdminAuditContext
): Promise<void> {
  await writeLegalAdminAuditLog(tx, {
    legalDocumentId: document.id,
    eventType: "LEGAL_DOCUMENT_CREATED",
    targetType: LEGAL_ADMIN_AUDIT_TARGET_TYPE.LEGAL_DOCUMENT,
    targetId: document.id,
    context,
    metadata: {
      documentType: documentTypeOf(document),
      title: document.title,
      description: document.description,
      audience: document.audience,
      requiredForOnboarding: document.required_for_onboarding,
      publicVisibility: document.public_visibility,
      showInAccount: document.show_in_account,
    },
  });
}

export async function writeLegalDocumentUpdatedAudit(
  tx: Prisma.TransactionClient,
  document: LegalDocumentRow,
  changedFields: string[],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  context: LegalAdminAuditContext
): Promise<void> {
  await writeLegalAdminAuditLog(tx, {
    legalDocumentId: document.id,
    eventType: "LEGAL_DOCUMENT_UPDATED",
    targetType: LEGAL_ADMIN_AUDIT_TARGET_TYPE.LEGAL_DOCUMENT,
    targetId: document.id,
    context,
    metadata: {
      documentType: documentTypeOf(document),
      changedFields,
      before,
      after,
    },
  });
}

export async function writeLegalDocumentVersionUploadedAudit(
  tx: Prisma.TransactionClient,
  version: VersionWithDocument,
  context: LegalAdminAuditContext
): Promise<void> {
  if (!version.file_hash) {
    throw new Error("LEGAL_DOCUMENT_VERSION_UPLOADED requires a server file hash.");
  }

  await writeLegalAdminAuditLog(tx, {
    legalDocumentId: version.legal_document_id,
    legalDocumentVersionId: version.id,
    eventType: "LEGAL_DOCUMENT_VERSION_UPLOADED",
    targetType: LEGAL_ADMIN_AUDIT_TARGET_TYPE.LEGAL_DOCUMENT_VERSION,
    targetId: version.id,
    context,
    metadata: {
      documentType: documentTypeOf(version.legal_document),
      versionId: version.id,
      versionNumber: version.version,
      fileName: version.file_name,
      fileHash: version.file_hash,
      mimeType: version.content_type,
      fileSizeBytes: version.file_size,
      status: "DRAFT",
    },
  });
}

export async function writeLegalDocumentVersionFileReplacedAudit(
  tx: Prisma.TransactionClient,
  before: VersionWithDocument,
  after: VersionWithDocument,
  context: LegalAdminAuditContext
): Promise<void> {
  if (!after.file_hash) {
    throw new Error("LEGAL_DOCUMENT_VERSION_FILE_REPLACED requires a server file hash.");
  }

  await writeLegalAdminAuditLog(tx, {
    legalDocumentId: after.legal_document_id,
    legalDocumentVersionId: after.id,
    eventType: "LEGAL_DOCUMENT_VERSION_FILE_REPLACED",
    targetType: LEGAL_ADMIN_AUDIT_TARGET_TYPE.LEGAL_DOCUMENT_VERSION,
    targetId: after.id,
    context,
    metadata: {
      documentType: documentTypeOf(after.legal_document),
      versionId: after.id,
      versionNumber: after.version,
      previousFileName: before.file_name,
      previousFileHash: before.file_hash,
      previousMimeType: before.content_type,
      previousFileSizeBytes: before.file_size,
      fileName: after.file_name,
      fileHash: after.file_hash,
      mimeType: after.content_type,
      fileSizeBytes: after.file_size,
    },
  });
}

export async function writeLegalDocumentVersionPublishedAudit(
  tx: Prisma.TransactionClient,
  before: VersionWithDocument,
  published: VersionWithDocument,
  context: LegalAdminAuditContext
): Promise<void> {
  if (!published.file_hash) {
    throw new Error("LEGAL_DOCUMENT_VERSION_PUBLISHED requires a server file hash.");
  }

  await writeLegalAdminAuditLog(tx, {
    legalDocumentId: published.legal_document_id,
    legalDocumentVersionId: published.id,
    eventType: "LEGAL_DOCUMENT_VERSION_PUBLISHED",
    targetType: LEGAL_ADMIN_AUDIT_TARGET_TYPE.LEGAL_DOCUMENT_VERSION,
    targetId: published.id,
    context,
    metadata: {
      documentType: documentTypeOf(published.legal_document),
      versionId: published.id,
      versionNumber: published.version,
      fileName: published.file_name,
      fileHash: published.file_hash,
      mimeType: published.content_type,
      fileSizeBytes: published.file_size,
      previousStatus: before.status,
      newStatus: "PUBLISHED",
      previousReacceptanceRequired: before.reacceptance_required,
      reacceptanceRequired: published.reacceptance_required,
    },
  });
}

export type AutoArchivedVersion = {
  id: string;
  version: number;
  file_hash: string | null;
  file_name: string;
  content_type: string;
  file_size: number;
};

export async function writeLegalDocumentVersionArchivedAudit(
  tx: Prisma.TransactionClient,
  params: {
    legalDocumentId: string;
    documentType: LegalDocumentType;
    version: AutoArchivedVersion | VersionWithDocument;
    previousStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    reasonCode?: LegalAdminArchiveReasonCode;
  },
  context: LegalAdminAuditContext
): Promise<void> {
  const version = params.version;
  await writeLegalAdminAuditLog(tx, {
    legalDocumentId: params.legalDocumentId,
    legalDocumentVersionId: version.id,
    eventType: "LEGAL_DOCUMENT_VERSION_ARCHIVED",
    targetType: LEGAL_ADMIN_AUDIT_TARGET_TYPE.LEGAL_DOCUMENT_VERSION,
    targetId: version.id,
    context,
    metadata: {
      documentType: params.documentType,
      versionId: version.id,
      versionNumber: version.version,
      fileName: version.file_name,
      fileHash: version.file_hash,
      mimeType: version.content_type,
      fileSizeBytes: version.file_size,
      previousStatus: params.previousStatus,
      newStatus: "ARCHIVED",
      ...(params.reasonCode ? { reasonCode: params.reasonCode } : {}),
    },
  });
}

export async function writeLegalDocumentVersionRestoredAudit(
  tx: Prisma.TransactionClient,
  restored: VersionWithDocument,
  restoredAs: "DRAFT" | "PUBLISHED",
  context: LegalAdminAuditContext
): Promise<void> {
  await writeLegalAdminAuditLog(tx, {
    legalDocumentId: restored.legal_document_id,
    legalDocumentVersionId: restored.id,
    eventType: "LEGAL_DOCUMENT_VERSION_RESTORED",
    targetType: LEGAL_ADMIN_AUDIT_TARGET_TYPE.LEGAL_DOCUMENT_VERSION,
    targetId: restored.id,
    context,
    metadata: {
      documentType: documentTypeOf(restored.legal_document),
      versionId: restored.id,
      versionNumber: restored.version,
      fileName: restored.file_name,
      fileHash: restored.file_hash,
      mimeType: restored.content_type,
      fileSizeBytes: restored.file_size,
      previousStatus: "ARCHIVED",
      newStatus: restoredAs,
      restoredAs,
      ...(restoredAs === "PUBLISHED"
        ? { reacceptanceRequired: restored.reacceptance_required }
        : {}),
    },
  });
}

export async function writeLegalDocumentVersionCreatedFromVersionAudit(
  tx: Prisma.TransactionClient,
  source: VersionWithDocument,
  created: VersionWithDocument,
  context: LegalAdminAuditContext
): Promise<void> {
  if (!created.file_hash) {
    throw new Error("LEGAL_DOCUMENT_VERSION_CREATED_FROM_VERSION requires a server file hash.");
  }

  await writeLegalAdminAuditLog(tx, {
    legalDocumentId: created.legal_document_id,
    legalDocumentVersionId: created.id,
    eventType: "LEGAL_DOCUMENT_VERSION_CREATED_FROM_VERSION",
    targetType: LEGAL_ADMIN_AUDIT_TARGET_TYPE.LEGAL_DOCUMENT_VERSION,
    targetId: created.id,
    context,
    metadata: {
      documentType: documentTypeOf(created.legal_document),
      sourceVersionId: source.id,
      sourceVersionNumber: source.version,
      newVersionId: created.id,
      newVersionNumber: created.version,
      fileName: created.file_name,
      fileHash: created.file_hash,
      mimeType: created.content_type,
      fileSizeBytes: created.file_size,
      status: "DRAFT",
    },
  });
}
