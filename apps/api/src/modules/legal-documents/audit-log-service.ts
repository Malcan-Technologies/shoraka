import { randomUUID } from "crypto";
import type { Request } from "express";
import { Prisma } from "@prisma/client";
import type { LegalDocumentType } from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import {
  AUDIT_PORTAL,
  AUDIT_TARGET_TYPE,
  auditContextFromRequest,
  loadAuditActorSnapshot,
  resolveStandardAuditFields,
} from "../../lib/audit";
import type { LegalDocumentAuditAction } from "./schemas";

export type RecordLegalDocumentAuditInput = {
  req: Request;
  action: LegalDocumentAuditAction;
  actorUserId: string;
  legalDocumentId?: string | null;
  legalDocumentVersionId?: string | null;
  documentType?: LegalDocumentType | null;
  versionNumber?: number | null;
  documentHash?: string | null;
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
  reason?: string | null;
};

function toJsonInputValue(
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class LegalDocumentAuditLogService {
  async record(input: RecordLegalDocumentAuditInput) {
    const { req, action, actorUserId } = input;
    const context = auditContextFromRequest(req, {
      actorUserId,
      // Legal document management is an admin-only surface.
      portal: AUDIT_PORTAL.ADMIN,
    });

    const standard = resolveStandardAuditFields({
      context,
      targetType: input.legalDocumentVersionId
        ? AUDIT_TARGET_TYPE.LEGAL_DOCUMENT_VERSION
        : AUDIT_TARGET_TYPE.LEGAL_DOCUMENT,
      targetId: input.legalDocumentVersionId ?? input.legalDocumentId,
    });
    const actor = await loadAuditActorSnapshot(actorUserId);

    return prisma.legalDocumentAuditLog.create({
      data: {
        id: randomUUID(),
        action,
        legal_document_id: input.legalDocumentId ?? null,
        legal_document_version_id: input.legalDocumentVersionId ?? null,
        document_type: input.documentType ?? null,
        version_number: input.versionNumber ?? null,
        document_hash: input.documentHash ?? null,
        actor_user_id: actorUserId,
        actor_name_snapshot: actor.actor_name_snapshot,
        actor_email_snapshot: actor.actor_email_snapshot,
        before_json: toJsonInputValue(input.beforeJson),
        after_json: toJsonInputValue(input.afterJson),
        reason: input.reason ?? null,
        ip_address: standard.ip_address,
        user_agent: standard.user_agent,
        correlation_id: standard.correlation_id,

        actor_type: standard.actor_type,
        target_type: standard.target_type,
        target_id: standard.target_id,
        source: standard.source,
        portal: standard.portal,
      },
    });
  }
}

export const legalDocumentAuditLogService = new LegalDocumentAuditLogService();
