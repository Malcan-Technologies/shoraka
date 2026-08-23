import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  AUDIT_ACTOR_TYPE,
  AUDIT_PORTAL,
  AUDIT_SOURCE,
  jsonAuditValue,
  type AuditRequestContext,
} from "../../../lib/audit/context";
import { loadAuditActorSnapshot } from "../../../lib/audit/snapshot";
import {
  SIGNING_AUDIT_TARGET_TYPE,
  type SigningAuditEventType,
  type SigningAuditTargetType,
} from "./events";
import { parseSigningAuditMetadata } from "./metadata";

export type SigningAuditWriteInput = {
  eventType: SigningAuditEventType;
  context: AuditRequestContext;
  signingEnvelopeId?: string | null;
  applicationId?: string | null;
  organizationId?: string | null;
  targetType: SigningAuditTargetType;
  targetId: string;
  idempotencyKey?: string | null;
  metadata: Record<string, unknown>;
};

async function resolveIssuerOrganizationId(
  applicationId: string | null | undefined,
  db: Prisma.TransactionClient | typeof prisma
): Promise<string | null> {
  if (!applicationId) return null;
  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: { issuer_organization_id: true },
  });
  return application?.issuer_organization_id ?? null;
}

export async function writeSigningAuditLog(
  input: SigningAuditWriteInput,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  const actor = await loadAuditActorSnapshot(input.context.actorUserId, db);
  const metadata = parseSigningAuditMetadata(input.eventType, {
    ...input.metadata,
    actorName: actor.name,
    actorEmail: actor.email,
  });
  const organizationId =
    input.organizationId !== undefined
      ? input.organizationId
      : await resolveIssuerOrganizationId(input.applicationId, db);

  await db.signingAuditLog.create({
    data: {
      signing_envelope_id: input.signingEnvelopeId ?? null,
      application_id: input.applicationId ?? null,
      event_type: input.eventType,
      actor_type: input.context.actorType || AUDIT_ACTOR_TYPE.USER,
      actor_user_id: input.context.actorUserId,
      organization_id: organizationId,
      organization_kind: organizationId ? "ISSUER" : null,
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

export function issuerSigningAuditContext(
  userId: string,
  extras?: Partial<AuditRequestContext>
): AuditRequestContext {
  return {
    actorType: extras?.actorType ?? AUDIT_ACTOR_TYPE.USER,
    actorUserId: extras?.actorUserId !== undefined ? extras.actorUserId : userId,
    source: extras?.source ?? AUDIT_SOURCE.API,
    portal: extras?.portal ?? AUDIT_PORTAL.ISSUER,
    ipAddress: extras?.ipAddress ?? null,
    userAgent: extras?.userAgent ?? null,
    correlationId: extras?.correlationId ?? null,
  };
}

export function adminSigningAuditContext(
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

export function publicSignerAuditContext(
  extras?: Partial<AuditRequestContext>
): AuditRequestContext {
  return {
    actorType: extras?.actorType ?? AUDIT_ACTOR_TYPE.USER,
    actorUserId: extras?.actorUserId ?? null,
    source: extras?.source ?? AUDIT_SOURCE.API,
    portal: extras?.portal ?? AUDIT_PORTAL.PUBLIC,
    ipAddress: extras?.ipAddress ?? null,
    userAgent: extras?.userAgent ?? null,
    correlationId: extras?.correlationId ?? null,
  };
}

export { SIGNING_AUDIT_TARGET_TYPE };
