/**
 * Standardized writers for the existing `note_events` and `note_admin_actions` tables.
 *
 * Legacy columns are written exactly as origin/main wrote them and `metadata` is passed through
 * byte-for-byte, because the admin note timeline renders metadata generically. The standard
 * forensic columns are additive, nullable, and derived only from values the caller already holds —
 * these writers issue no extra query, which matters because nearly every caller runs inside a
 * business transaction.
 *
 * Lives in `lib/audit` rather than the notes module so `lib/` helpers (facility occupancy
 * recomputation) can use it without an import cycle.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { AUDIT_TARGET_TYPE, AuditRequestContext, AuditSource, AuditTargetType } from "./context";
import { resolveStandardAuditFields } from "./standard-fields";

type NoteAuditDb = Prisma.TransactionClient | typeof prisma;

export type CreateNoteEventParams = {
  noteId: string;
  eventType: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  portal?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  metadata?: Prisma.InputJsonValue | Record<string, unknown> | null;
  createdAt?: Date;

  context?: AuditRequestContext | null;
  source?: AuditSource | null;
  targetType?: AuditTargetType | null;
  targetId?: string | null;
};

export async function createNoteEventRow(db: NoteAuditDb, params: CreateNoteEventParams) {
  const standard = resolveStandardAuditFields({
    context: params.context,
    actorUserId: params.actorUserId,
    portal: params.portal,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    correlationId: params.correlationId,
    source: params.source,
    targetType: params.targetType ?? AUDIT_TARGET_TYPE.NOTE,
    targetId: params.targetId ?? params.noteId,
    systemWhenActorless: true,
  });

  return db.noteEvent.create({
    data: {
      note_id: params.noteId,
      event_type: params.eventType,
      actor_user_id: params.actorUserId ?? null,
      actor_role: params.actorRole ?? null,
      portal: params.portal ?? null,
      ip_address: standard.ip_address,
      user_agent: standard.user_agent,
      correlation_id: standard.correlation_id,
      metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ...(params.createdAt ? { created_at: params.createdAt } : {}),

      actor_type: standard.actor_type,
      target_type: standard.target_type,
      target_id: standard.target_id,
      source: standard.source,
    },
  });
}

export type CreateNoteAdminActionParams = {
  noteId: string;
  actionType: string;
  actorUserId: string;
  reason?: string | null;
  beforeState?: Prisma.InputJsonValue | null;
  afterState?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  portal?: string | null;

  context?: AuditRequestContext | null;
  source?: AuditSource | null;
  targetType?: AuditTargetType | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function createNoteAdminActionRow(
  db: NoteAuditDb,
  params: CreateNoteAdminActionParams
) {
  const standard = resolveStandardAuditFields({
    context: params.context,
    actorUserId: params.actorUserId,
    portal: params.portal,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    correlationId: params.correlationId,
    source: params.source,
    targetType: params.targetType ?? AUDIT_TARGET_TYPE.NOTE,
    targetId: params.targetId ?? params.noteId,
  });

  return db.noteAdminAction.create({
    data: {
      note_id: params.noteId,
      action_type: params.actionType,
      actor_user_id: params.actorUserId,
      reason: params.reason ?? null,
      before_state: params.beforeState ?? undefined,
      after_state: params.afterState ?? undefined,
      ip_address: standard.ip_address,
      user_agent: standard.user_agent,
      correlation_id: standard.correlation_id,

      actor_type: standard.actor_type,
      portal: standard.portal,
      target_type: standard.target_type,
      target_id: standard.target_id,
      source: standard.source,
      metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
