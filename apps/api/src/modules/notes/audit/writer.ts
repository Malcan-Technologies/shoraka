import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  AUDIT_ACTOR_TYPE,
  AUDIT_PORTAL,
  AUDIT_SOURCE,
  auditPortalFromLegacy,
  jsonAuditValue,
  type AuditRequestContext,
} from "../../../lib/audit/context";
import { loadAuditActorSnapshot } from "../../../lib/audit/snapshot";
import {
  NOTE_AUDIT_TARGET_TYPE,
  type NoteAuditEventType,
  type NoteAuditTargetType,
} from "./events";
import { parseNoteAuditMetadata } from "./metadata";

export type NoteActorInput = {
  userId: string;
  role?: string;
  portal?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
};

export type NoteAuditWriteInput = {
  eventType: NoteAuditEventType;
  context: AuditRequestContext;
  noteId?: string | null;
  organizationId?: string | null;
  organizationKind?: string | null;
  targetType: NoteAuditTargetType;
  targetId: string;
  idempotencyKey?: string | null;
  metadata: Record<string, unknown>;
};

async function resolveIssuerOrganizationId(
  noteId: string | null | undefined,
  db: Prisma.TransactionClient | typeof prisma
): Promise<string | null> {
  if (!noteId) return null;
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: { issuer_organization_id: true },
  });
  return note?.issuer_organization_id ?? null;
}

export async function writeNoteAuditLog(
  input: NoteAuditWriteInput,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  const isTrusteeSignature = input.eventType === "TRUSTEE_SIGNATURE_UPDATED";
  if (!isTrusteeSignature && !input.noteId) {
    throw new Error(`note_id is required for ${input.eventType}`);
  }

  const noteId = isTrusteeSignature ? null : input.noteId ?? null;
  const actor = await loadAuditActorSnapshot(input.context.actorUserId, db);
  const metadata = parseNoteAuditMetadata(input.eventType, {
    ...input.metadata,
    actorName: actor.name,
    actorEmail: actor.email,
  });
  const organizationId =
    input.organizationId !== undefined
      ? input.organizationId
      : await resolveIssuerOrganizationId(noteId, db);

  await db.noteAuditLog.create({
    data: {
      note_id: noteId,
      event_type: input.eventType,
      actor_type: input.context.actorType || AUDIT_ACTOR_TYPE.USER,
      actor_user_id: input.context.actorUserId,
      organization_id: organizationId,
      organization_kind:
        input.organizationKind !== undefined
          ? input.organizationKind
          : organizationId
            ? "ISSUER"
            : null,
      target_type: input.targetType,
      target_id: input.targetId,
      source: input.context.source || AUDIT_SOURCE.API,
      portal: input.context.portal,
      ip_address: input.context.ipAddress,
      user_agent: input.context.userAgent,
      correlation_id: input.context.correlationId,
      idempotency_key: input.idempotencyKey ?? null,
      metadata: jsonAuditValue(metadata),
    },
  });
}

export function noteAuditContextFromActor(
  actor: NoteActorInput,
  extras?: Partial<AuditRequestContext>
): AuditRequestContext {
  const isSystem = actor.userId === "SYS";
  const portal = extras?.portal ?? auditPortalFromLegacy(actor.portal);
  const isAdmin = portal === AUDIT_PORTAL.ADMIN || String(actor.role ?? "").toUpperCase() === "ADMIN";
  return {
    actorType:
      extras?.actorType ??
      (isSystem ? AUDIT_ACTOR_TYPE.SYSTEM : isAdmin ? AUDIT_ACTOR_TYPE.ADMIN : AUDIT_ACTOR_TYPE.USER),
    actorUserId: extras?.actorUserId !== undefined ? extras.actorUserId : isSystem ? null : actor.userId,
    source: extras?.source ?? (isSystem ? AUDIT_SOURCE.SYSTEM_JOB : AUDIT_SOURCE.API),
    portal,
    ipAddress: extras?.ipAddress !== undefined ? extras.ipAddress : actor.ipAddress ?? null,
    userAgent: extras?.userAgent !== undefined ? extras.userAgent : actor.userAgent ?? null,
    correlationId:
      extras?.correlationId !== undefined ? extras.correlationId : actor.correlationId ?? null,
  };
}

export function adminNoteAuditContext(
  userId: string,
  extras?: Partial<AuditRequestContext>
): AuditRequestContext {
  return {
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorUserId: extras?.actorUserId !== undefined ? extras.actorUserId : userId,
    source: extras?.source ?? AUDIT_SOURCE.API,
    portal: AUDIT_PORTAL.ADMIN,
    ipAddress: extras?.ipAddress ?? null,
    userAgent: extras?.userAgent ?? null,
    correlationId: extras?.correlationId ?? null,
  };
}

export function integrationNoteAuditContext(
  extras?: Partial<AuditRequestContext>
): AuditRequestContext {
  return {
    actorType: extras?.actorType ?? AUDIT_ACTOR_TYPE.INTEGRATION,
    actorUserId: extras?.actorUserId ?? null,
    source: extras?.source ?? AUDIT_SOURCE.INTERNAL,
    portal: extras?.portal ?? AUDIT_PORTAL.ADMIN,
    ipAddress: extras?.ipAddress ?? null,
    userAgent: extras?.userAgent ?? null,
    correlationId: extras?.correlationId ?? null,
  };
}

export async function writeNoteAuditFromActor(
  actor: NoteActorInput,
  input: Omit<NoteAuditWriteInput, "context">,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  await writeNoteAuditLog(
    {
      ...input,
      context: noteAuditContextFromActor(actor),
    },
    db
  );
}

export function noteAuditEventForWithdrawal(
  withdrawalType: string,
  operation: "initiated" | "letter" | "submitted" | "beneficiary" | "completed"
): NoteAuditEventType | null {
  if (withdrawalType === "ISSUER_DISBURSEMENT") {
    if (operation === "initiated") return "DISBURSEMENT_INITIATED";
    if (operation === "letter") return "DISBURSEMENT_LETTER_GENERATED";
    if (operation === "submitted") return "DISBURSEMENT_SUBMITTED_TO_TRUSTEE";
    if (operation === "beneficiary") return "DISBURSEMENT_BENEFICIARY_UPDATED";
    return "DISBURSEMENT_COMPLETED";
  }
  if (withdrawalType === "ISSUER_RESIDUAL_RETURN") {
    if (operation === "letter") return "RESIDUAL_RETURN_LETTER_GENERATED";
    if (operation === "submitted") return "RESIDUAL_RETURN_SUBMITTED_TO_TRUSTEE";
    if (operation === "completed") return "RESIDUAL_RETURN_COMPLETED";
    return null;
  }
  return null;
}

export { NOTE_AUDIT_TARGET_TYPE };
