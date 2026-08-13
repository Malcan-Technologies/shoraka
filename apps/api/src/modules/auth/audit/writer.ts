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
import { ACCESS_AUDIT_TARGET_TYPE, type AccessAuditEventType } from "./events";
import { parseAccessAuditMetadata } from "./metadata";

export type AccessAuditWriteInput = {
  eventType: AccessAuditEventType;
  context: AuditRequestContext;
  userId: string;
  metadata: Record<string, unknown>;
};

async function writeAccessAuditLog(
  input: AccessAuditWriteInput,
  db: Prisma.TransactionClient = prisma
): Promise<void> {
  const actor = await loadAuditActorSnapshot(input.context.actorUserId ?? input.userId, db);
  const metadata = parseAccessAuditMetadata(input.eventType, {
    ...input.metadata,
    actorName: actor.name,
    actorEmail: actor.email,
  });

  await db.accessAuditLog.create({
    data: {
      user_id: input.userId,
      event_type: input.eventType,
      actor_type: input.context.actorType || AUDIT_ACTOR_TYPE.USER,
      actor_user_id: input.context.actorUserId ?? input.userId,
      organization_id: null,
      organization_kind: null,
      target_type: ACCESS_AUDIT_TARGET_TYPE,
      target_id: input.userId,
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
 * Access audit must not break successful authentication or logout.
 */
export async function writeAccessAuditLogBestEffort(
  input: AccessAuditWriteInput,
  db: Prisma.TransactionClient = prisma
): Promise<void> {
  try {
    await writeAccessAuditLog(input, db);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        eventType: input.eventType,
        userId: input.userId,
      },
      "Failed to persist AccessAuditLog (non-blocking)"
    );
  }
}
