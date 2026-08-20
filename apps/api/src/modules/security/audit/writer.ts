import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../../lib/logger";
import {
  AUDIT_ACTOR_TYPE,
  AUDIT_SOURCE,
  jsonAuditValue,
  type AuditRequestContext,
} from "../../../lib/audit/context";
import { loadAuditActorSnapshot } from "../../../lib/audit/snapshot";
import {
  SECURITY_AUDIT_TARGET_TYPE,
  type SecurityAuditEventType,
  type SecurityAuditTargetType,
} from "./events";
import { parseSecurityAuditMetadata } from "./metadata";

export type SecurityAuditWriteInput = {
  eventType: SecurityAuditEventType;
  context: AuditRequestContext;
  subjectUserId?: string | null;
  targetType: SecurityAuditTargetType;
  targetId: string;
  organizationId?: string | null;
  organizationKind?: string | null;
  metadata: Record<string, unknown>;
};

export async function writeSecurityAuditLog(
  input: SecurityAuditWriteInput,
  db: Prisma.TransactionClient = prisma
): Promise<void> {
  const actor = await loadAuditActorSnapshot(input.context.actorUserId, db);
  const metadata = parseSecurityAuditMetadata(input.eventType, {
    ...input.metadata,
    actorName: actor.name,
    actorEmail: actor.email,
  });

  await db.securityAuditLog.create({
    data: {
      subject_user_id: input.subjectUserId ?? null,
      event_type: input.eventType,
      actor_type: input.context.actorType || AUDIT_ACTOR_TYPE.USER,
      actor_user_id: input.context.actorUserId,
      organization_id: input.organizationId ?? null,
      organization_kind: input.organizationKind ?? null,
      target_type: input.targetType,
      target_id: input.targetId,
      source: input.context.source || AUDIT_SOURCE.API,
      portal: input.context.portal,
      ip_address: input.context.ipAddress,
      user_agent: input.context.userAgent,
      correlation_id: input.context.correlationId,
      idempotency_key: null,
      metadata: jsonAuditValue(metadata),
    },
  });
}

/**
 * 403 / denial audit must not change HTTP behavior.
 */
export async function writeSecurityAuditLogBestEffort(
  input: SecurityAuditWriteInput,
  db: Prisma.TransactionClient = prisma
): Promise<void> {
  try {
    await writeSecurityAuditLog(input, db);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        eventType: input.eventType,
        targetId: input.targetId,
      },
      "Failed to persist SecurityAuditLog (non-blocking)"
    );
  }
}

export { SECURITY_AUDIT_TARGET_TYPE };
