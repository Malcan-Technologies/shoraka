import { GatewayPaymentEventType, GatewayPaymentStatus, Prisma } from "@prisma/client";
import {
  AUDIT_TARGET_TYPE,
  AuditRequestContext,
  AuditSource,
  resolveStandardAuditFields,
} from "../../lib/audit";

type RecordEventInput = {
  gatewayPaymentId: string;
  type: GatewayPaymentEventType;
  actorUserId?: string;
  fromStatus?: GatewayPaymentStatus | null;
  toStatus?: GatewayPaymentStatus | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;

  /**
   * Forensic context. Admin resolution actions should pass the request context; Curlec webhook and
   * reconciliation paths should pass `webhookAuditContext()` / `systemAuditContext()`.
   */
  context?: AuditRequestContext | null;
  source?: AuditSource | null;
};

export async function recordGatewayPaymentEvent(
  tx: Prisma.TransactionClient,
  input: RecordEventInput
) {
  const standard = resolveStandardAuditFields({
    context: input.context,
    actorUserId: input.actorUserId,
    source: input.source,
    targetType: AUDIT_TARGET_TYPE.GATEWAY_PAYMENT,
    targetId: input.gatewayPaymentId,
    // Unattended transitions (webhook capture, refund sweeps) have no actor.
    systemWhenActorless: true,
  });

  return tx.gatewayPaymentEvent.create({
    data: {
      gateway_payment_id: input.gatewayPaymentId,
      type: input.type,
      actor_user_id: input.actorUserId ?? null,
      from_status: input.fromStatus ?? null,
      to_status: input.toStatus ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata,

      actor_type: standard.actor_type,
      target_type: standard.target_type,
      target_id: standard.target_id,
      source: standard.source,
      portal: standard.portal,
      ip_address: standard.ip_address,
      user_agent: standard.user_agent,
      correlation_id: standard.correlation_id,
    },
  });
}

const OVERRIDE_RESOLUTION_TYPES: GatewayPaymentEventType[] = [
  GatewayPaymentEventType.OVERRIDE_PROPOSED,
  GatewayPaymentEventType.OVERRIDE_APPROVED,
  GatewayPaymentEventType.OVERRIDE_REJECTED,
];

export async function getOpenOverrideProposal(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  gatewayPaymentId: string
) {
  const latest = await db.gatewayPaymentEvent.findFirst({
    where: {
      gateway_payment_id: gatewayPaymentId,
      type: { in: OVERRIDE_RESOLUTION_TYPES },
    },
    orderBy: { created_at: "desc" },
  });

  if (!latest || latest.type !== GatewayPaymentEventType.OVERRIDE_PROPOSED) {
    return null;
  }

  return {
    eventId: latest.id,
    proposedByUserId: latest.actor_user_id,
    reason: latest.reason,
    proposedAt: latest.created_at,
  };
}

export function mapGatewayPaymentEvent(
  event: {
    id: string;
    type: GatewayPaymentEventType;
    actor_user_id: string | null;
    from_status: GatewayPaymentStatus | null;
    to_status: GatewayPaymentStatus | null;
    reason: string | null;
    created_at: Date;
  },
  actorName: string | null = null
) {
  return {
    id: event.id,
    type: event.type,
    actorUserId: event.actor_user_id,
    actorName,
    fromStatus: event.from_status,
    toStatus: event.to_status,
    reason: event.reason,
    createdAt: event.created_at.toISOString(),
  };
}
