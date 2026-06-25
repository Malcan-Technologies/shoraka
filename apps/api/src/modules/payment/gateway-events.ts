import {
  GatewayPaymentEventType,
  GatewayPaymentStatus,
  Prisma,
} from "@prisma/client";

type RecordEventInput = {
  gatewayPaymentId: string;
  type: GatewayPaymentEventType;
  actorUserId?: string;
  fromStatus?: GatewayPaymentStatus | null;
  toStatus?: GatewayPaymentStatus | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function recordGatewayPaymentEvent(
  tx: Prisma.TransactionClient,
  input: RecordEventInput
) {
  return tx.gatewayPaymentEvent.create({
    data: {
      gateway_payment_id: input.gatewayPaymentId,
      type: input.type,
      actor_user_id: input.actorUserId ?? null,
      from_status: input.fromStatus ?? null,
      to_status: input.toStatus ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata,
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

export function mapGatewayPaymentEvent(event: {
  id: string;
  type: GatewayPaymentEventType;
  actor_user_id: string | null;
  from_status: GatewayPaymentStatus | null;
  to_status: GatewayPaymentStatus | null;
  reason: string | null;
  created_at: Date;
}) {
  return {
    id: event.id,
    type: event.type,
    actorUserId: event.actor_user_id,
    fromStatus: event.from_status,
    toStatus: event.to_status,
    reason: event.reason,
    createdAt: event.created_at.toISOString(),
  };
}
