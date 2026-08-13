import { randomUUID } from "crypto";
import type { Request } from "express";
import { Prisma } from "@prisma/client";
import type { LegalDocumentType } from "@cashsouk/types";
import { extractRequestMetadata } from "../../lib/http/request-utils";
import { prisma } from "../../lib/prisma";
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

async function loadActorSnapshot(userId: string): Promise<{
  name: string | null;
  email: string | null;
}> {
  const user = await prisma.user.findUnique({
    where: { user_id: userId },
    select: { email: true, first_name: true, last_name: true },
  });
  if (!user) return { name: null, email: null };
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return { name: name || null, email: user.email };
}

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
    const { ipAddress, userAgent } = extractRequestMetadata(req);
    const correlationId =
      typeof (req as Request & { res?: { locals?: { correlationId?: string } } }).res?.locals
        ?.correlationId === "string"
        ? (req as Request & { res?: { locals?: { correlationId?: string } } }).res!.locals!
            .correlationId
        : null;

    const actor = await loadActorSnapshot(actorUserId);

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
        actor_name_snapshot: actor.name,
        actor_email_snapshot: actor.email,
        before_json: toJsonInputValue(input.beforeJson),
        after_json: toJsonInputValue(input.afterJson),
        reason: input.reason ?? null,
        ip_address: ipAddress,
        user_agent: userAgent,
        correlation_id: correlationId,
      },
    });
  }
}

export const legalDocumentAuditLogService = new LegalDocumentAuditLogService();
