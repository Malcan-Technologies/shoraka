import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  AUDIT_ACTOR_TYPE,
  AUDIT_SOURCE,
  jsonAuditValue,
  type AuditRequestContext,
} from "../../../lib/audit/context";
import { loadAuditActorSnapshot } from "../../../lib/audit/snapshot";
import {
  ONBOARDING_AUDIT_TARGET_TYPE,
  type OnboardingAuditEventType,
  type OnboardingAuditTargetType,
} from "./events";
import { parseOnboardingAuditMetadata } from "./metadata";

export type OnboardingAuditWriteInput = {
  eventType: OnboardingAuditEventType;
  context: AuditRequestContext;
  subjectUserId?: string | null;
  onboardingId?: string | null;
  organizationId?: string | null;
  organizationKind?: "INVESTOR" | "ISSUER" | null;
  organizationType?: "PERSONAL" | "COMPANY" | null;
  targetType: OnboardingAuditTargetType;
  targetId: string;
  idempotencyKey?: string | null;
  metadata: Record<string, unknown>;
};

export async function writeOnboardingAuditLog(
  input: OnboardingAuditWriteInput,
  db: Prisma.TransactionClient = prisma
): Promise<void> {
  const actor = await loadAuditActorSnapshot(input.context.actorUserId, db);
  const metadata = parseOnboardingAuditMetadata(input.eventType, {
    ...input.metadata,
    actorName: actor.name,
    actorEmail: actor.email,
  });

  await db.onboardingAuditLog.create({
    data: {
      onboarding_id: input.onboardingId ?? null,
      event_type: input.eventType,
      actor_type: input.context.actorType || AUDIT_ACTOR_TYPE.USER,
      actor_user_id: input.context.actorUserId,
      subject_user_id: input.subjectUserId ?? null,
      organization_id: input.organizationId ?? null,
      organization_kind: input.organizationKind ?? null,
      organization_type: input.organizationType ?? null,
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

export { ONBOARDING_AUDIT_TARGET_TYPE };
