import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  NOTIFICATION_BROADCAST_AUDIT_TARGET_TYPE,
  type NotificationBroadcastAuditEventType,
} from "./events";
import type { NotificationBroadcastAuditContext } from "./context";
import {
  parseNotificationBroadcastAuditMetadata,
  type NotificationBroadcastProcessedAuditMetadata,
} from "./metadata";

export type NotificationBroadcastAuditWriteInput = {
  eventType: NotificationBroadcastAuditEventType;
  context: NotificationBroadcastAuditContext;
  audienceType: string;
  notificationTypeId: string;
  metadata: Omit<NotificationBroadcastProcessedAuditMetadata, "actorName" | "actorEmail">;
};

function generateNotificationBroadcastAuditId(): string {
  return `c${Date.now().toString(36)}${randomBytes(10).toString("hex")}`;
}

async function loadActorSnapshot(
  db: Prisma.TransactionClient,
  userId: string
): Promise<{ name: string | null; email: string | null }> {
  const user = await db.user.findUnique({
    where: { user_id: userId },
    select: { email: true, first_name: true, last_name: true },
  });
  if (!user) return { name: null, email: null };
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return { name: name || null, email: user.email };
}

/**
 * Writes one NOTIFICATION_BROADCAST_PROCESSED row after recipient processing.
 * Call this outside the per-recipient Notification/email loop. Failure here must
 * not roll back already-created Notification rows (this insert is not in that
 * loop's transactions).
 */
export async function writeNotificationBroadcastProcessedAudit(
  input: NotificationBroadcastAuditWriteInput,
  db: Prisma.TransactionClient = prisma
): Promise<string> {
  if (!input.context.actorUserId) {
    throw new Error("Notification broadcast audit write requires actorUserId.");
  }

  const actor = await loadActorSnapshot(db, input.context.actorUserId);
  const metadata = parseNotificationBroadcastAuditMetadata(input.eventType, {
    ...input.metadata,
    actorName: actor.name,
    actorEmail: actor.email,
  });

  const id = generateNotificationBroadcastAuditId();

  await db.notificationBroadcastAuditLog.create({
    data: {
      id,
      event_type: input.eventType,
      actor_type: input.context.actorType,
      actor_user_id: input.context.actorUserId,
      organization_id: input.context.organizationId,
      organization_kind: input.context.organizationKind,
      target_type: NOTIFICATION_BROADCAST_AUDIT_TARGET_TYPE,
      target_id: id,
      source: input.context.source,
      portal: input.context.portal,
      ip_address: input.context.ipAddress ?? null,
      user_agent: input.context.userAgent ?? null,
      correlation_id: input.context.correlationId ?? null,
      idempotency_key: input.context.idempotencyKey ?? null,
      audience_type: input.audienceType,
      notification_type_id: input.notificationTypeId,
      metadata: JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue,
    },
  });

  return id;
}
