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
  APPLICATION_AUDIT_TARGET_TYPE,
  type ApplicationAuditEventType,
  type ApplicationAuditTargetType,
} from "./events";
import { parseApplicationAuditMetadata } from "./metadata";
import type { ApplicationDocumentAuditChange } from "./documents";

export type ApplicationAuditWriteInput = {
  eventType: ApplicationAuditEventType;
  context: AuditRequestContext;
  applicationId: string;
  organizationId?: string | null;
  targetType: ApplicationAuditTargetType;
  targetId: string;
  idempotencyKey?: string | null;
  metadata: Record<string, unknown>;
};

async function resolveIssuerOrganizationId(
  applicationId: string,
  db: Prisma.TransactionClient | typeof prisma
): Promise<string | null> {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: { issuer_organization_id: true },
  });
  return application?.issuer_organization_id ?? null;
}

export async function writeApplicationAuditLog(
  input: ApplicationAuditWriteInput,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  const actor = await loadAuditActorSnapshot(input.context.actorUserId, db);
  const metadata = parseApplicationAuditMetadata(input.eventType, {
    ...input.metadata,
    actorName: actor.name,
    actorEmail: actor.email,
  });
  const organizationId =
    input.organizationId !== undefined
      ? input.organizationId
      : await resolveIssuerOrganizationId(input.applicationId, db);

  await db.applicationAuditLog.create({
    data: {
      application_id: input.applicationId,
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

export async function writeApplicationDocumentAuditLogs(
  applicationId: string,
  context: AuditRequestContext,
  changes: ApplicationDocumentAuditChange[],
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  for (const change of changes) {
    await writeApplicationAuditLog(
      {
        eventType: change.eventType,
        context,
        applicationId,
        targetType: APPLICATION_AUDIT_TARGET_TYPE.DOCUMENT,
        targetId: change.identity,
        metadata: {
          documentCategory: change.documentCategory,
          ...(change.slotName ? { slotName: change.slotName } : {}),
          ...(change.workflowId ? { workflowId: change.workflowId } : {}),
          ...(change.fileName ? { fileName: change.fileName } : {}),
          ...(change.fileSizeBytes != null ? { fileSizeBytes: change.fileSizeBytes } : {}),
          ...(change.mimeType ? { mimeType: change.mimeType } : {}),
          ...(change.fileHash ? { fileHash: change.fileHash } : {}),
        },
      },
      db
    );
  }
}

export function issuerApplicationAuditContext(
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

export function adminApplicationAuditContext(
  reviewerUserId: string,
  extras?: Partial<AuditRequestContext> & {
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): AuditRequestContext {
  return {
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorUserId: reviewerUserId,
    source: extras?.source ?? AUDIT_SOURCE.API,
    portal: AUDIT_PORTAL.ADMIN,
    ipAddress: extras?.ipAddress ?? null,
    userAgent: extras?.userAgent ?? null,
    correlationId: extras?.correlationId ?? null,
  };
}

export { APPLICATION_AUDIT_TARGET_TYPE };
