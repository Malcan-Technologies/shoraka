import type { GatewayPayment, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  AUDIT_ACTOR_TYPE,
  AUDIT_PORTAL,
  AUDIT_SOURCE,
  auditPortalFromLegacy,
  jsonAuditValue,
  systemAuditContext,
  webhookAuditContext,
  type AuditRequestContext,
} from "../../../lib/audit/context";
import { loadAuditActorSnapshot } from "../../../lib/audit/snapshot";
import {
  PAYMENT_AUDIT_PROVIDER,
  PAYMENT_AUDIT_TARGET_TYPE,
  type PaymentAuditEventType,
  type PaymentAuditTargetType,
} from "./events";
import { parsePaymentAuditMetadata } from "./metadata";

export type PaymentActorInput = {
  userId: string;
  role?: string;
  portal?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
};

export type PaymentAuditWriteInput = {
  eventType: PaymentAuditEventType;
  context: AuditRequestContext;
  gatewayPaymentId?: string | null;
  organizationId?: string | null;
  organizationKind?: string | null;
  targetType: PaymentAuditTargetType;
  targetId: string;
  idempotencyKey?: string | null;
  metadata: Record<string, unknown>;
};

const GATEWAY_PAYMENT_EVENTS = new Set<PaymentAuditEventType>([
  "PAYMENT_INITIATED",
  "PAYMENT_CAPTURED",
  "PAYMENT_FAILED",
  "PAYMENT_EXPIRED",
  "PAYMENT_CAPTURE_MISMATCH_DETECTED",
  "PAYMENT_REFUND_INITIATED",
  "PAYMENT_REFUNDED",
  "PAYMENT_REFUND_WALLET_REVERSAL_FAILED",
  "PAYMENT_NAME_CHECK_PENDING",
  "PAYMENT_NAME_CHECK_APPROVED",
  "PAYMENT_NAME_CHECK_REJECTED",
  "INVESTOR_DEPOSIT_RECEIVED",
]);

function isUniqueConstraintError(error: unknown, target: string): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") {
    return false;
  }
  const meta = "meta" in error && error.meta && typeof error.meta === "object" ? error.meta : null;
  const constraint = meta && "target" in meta ? meta.target : null;
  return Array.isArray(constraint) ? constraint.includes(target) : constraint === target;
}

export function organizationFromGatewayPayment(payment: {
  investor_organization_id?: string | null;
  issuer_organization_id?: string | null;
}): { organizationId: string | null; organizationKind: "INVESTOR" | "ISSUER" | null } {
  if (payment.investor_organization_id) {
    return { organizationId: payment.investor_organization_id, organizationKind: "INVESTOR" };
  }
  if (payment.issuer_organization_id) {
    return { organizationId: payment.issuer_organization_id, organizationKind: "ISSUER" };
  }
  return { organizationId: null, organizationKind: null };
}

export async function writePaymentAuditLog(
  input: PaymentAuditWriteInput,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  const requiresGatewayPayment = GATEWAY_PAYMENT_EVENTS.has(input.eventType);
  if (requiresGatewayPayment && !input.gatewayPaymentId) {
    throw new Error(`gateway_payment_id is required for ${input.eventType}`);
  }

  const actor = await loadAuditActorSnapshot(input.context.actorUserId, db);
  const metadata = parsePaymentAuditMetadata(input.eventType, {
    ...input.metadata,
    actorName: actor.name,
    actorEmail: actor.email,
  });

  try {
    if (input.idempotencyKey) {
      const existing = await db.paymentAuditLog.findUnique({
        where: { idempotency_key: input.idempotencyKey },
        select: { id: true },
      });
      if (existing) return;
    }
    await db.paymentAuditLog.create({
      data: {
        gateway_payment_id: input.gatewayPaymentId ?? null,
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
        idempotency_key: input.idempotencyKey ?? null,
        metadata: jsonAuditValue(metadata),
      },
    });
  } catch (error) {
    if (
      input.idempotencyKey &&
      (isUniqueConstraintError(error, "idempotency_key") ||
        isUniqueConstraintError(error, "payment_audit_logs_idempotency_key_key"))
    ) {
      return;
    }
    throw error;
  }
}

export function paymentAuditContextFromActor(
  actor: PaymentActorInput,
  extras?: Partial<AuditRequestContext>
): AuditRequestContext {
  const portal = extras?.portal ?? auditPortalFromLegacy(actor.portal);
  const isAdmin =
    portal === AUDIT_PORTAL.ADMIN || String(actor.role ?? "").toUpperCase() === "ADMIN";
  return {
    actorType:
      extras?.actorType ?? (isAdmin ? AUDIT_ACTOR_TYPE.ADMIN : AUDIT_ACTOR_TYPE.USER),
    actorUserId: extras?.actorUserId !== undefined ? extras.actorUserId : actor.userId,
    source: extras?.source ?? AUDIT_SOURCE.API,
    portal,
    ipAddress: extras?.ipAddress !== undefined ? extras.ipAddress : actor.ipAddress ?? null,
    userAgent: extras?.userAgent !== undefined ? extras.userAgent : actor.userAgent ?? null,
    correlationId:
      extras?.correlationId !== undefined ? extras.correlationId : actor.correlationId ?? null,
  };
}

export function adminPaymentAuditContext(
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

export function webhookPaymentAuditContext(
  extras?: Partial<AuditRequestContext>
): AuditRequestContext {
  return webhookAuditContext({
    actorType: extras?.actorType,
    actorUserId: extras?.actorUserId ?? null,
    portal: extras?.portal ?? null,
    correlationId: extras?.correlationId ?? null,
  });
}

export function systemPaymentAuditContext(
  extras?: Partial<AuditRequestContext>
): AuditRequestContext {
  return systemAuditContext({
    source: extras?.source ?? AUDIT_SOURCE.SYSTEM_JOB,
    portal: extras?.portal ?? AUDIT_PORTAL.ADMIN,
    actorUserId: extras?.actorUserId ?? null,
    correlationId: extras?.correlationId ?? null,
  });
}

export async function writePaymentAuditFromActor(
  actor: PaymentActorInput,
  input: Omit<PaymentAuditWriteInput, "context">,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  await writePaymentAuditLog(
    {
      ...input,
      context: paymentAuditContextFromActor(actor),
    },
    db
  );
}

export async function writeGatewayPaymentAudit(
  payment: Pick<
    GatewayPayment,
    | "id"
    | "investor_organization_id"
    | "issuer_organization_id"
    | "purpose"
    | "amount"
    | "currency"
    | "gatewayAccount"
    | "curlec_order_id"
    | "curlec_payment_id"
  >,
  input: {
    eventType: PaymentAuditEventType;
    context: AuditRequestContext;
    idempotencyKey: string;
    metadata: Record<string, unknown>;
    targetType?: PaymentAuditTargetType;
    targetId?: string;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  const org = organizationFromGatewayPayment(payment);
  await writePaymentAuditLog(
    {
      eventType: input.eventType,
      context: input.context,
      gatewayPaymentId: payment.id,
      organizationId: org.organizationId,
      organizationKind: org.organizationKind,
      targetType: input.targetType ?? PAYMENT_AUDIT_TARGET_TYPE.GATEWAY_PAYMENT,
      targetId: input.targetId ?? payment.id,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    },
    db
  );
}

export function gatewayPaymentAmount(payment: { amount: { toNumber(): number } | number }): number {
  if (typeof payment.amount === "number") return payment.amount;
  return payment.amount.toNumber();
}

export async function writeInvestorWithdrawalAudit(
  actor: PaymentActorInput,
  input: {
    eventType: PaymentAuditEventType;
    withdrawalId: string;
    organizationId: string | null;
    idempotencyKey: string;
    metadata: Record<string, unknown>;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  await writePaymentAuditFromActor(
    actor,
    {
      eventType: input.eventType,
      gatewayPaymentId: null,
      organizationId: input.organizationId,
      organizationKind: input.organizationId ? "INVESTOR" : null,
      targetType: PAYMENT_AUDIT_TARGET_TYPE.WITHDRAWAL,
      targetId: input.withdrawalId,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    },
    db
  );
}

export async function writeReconExceptionAudit(
  input: {
    eventType:
      | "PAYMENT_RECONCILIATION_EXCEPTION_DETECTED"
      | "PAYMENT_RECONCILIATION_EXCEPTION_RESOLVED";
    context: AuditRequestContext;
    exceptionId: string;
    idempotencyKey: string;
    metadata: Record<string, unknown>;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  await writePaymentAuditLog(
    {
      eventType: input.eventType,
      context: input.context,
      gatewayPaymentId: null,
      targetType: PAYMENT_AUDIT_TARGET_TYPE.RECON_EXCEPTION,
      targetId: input.exceptionId,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    },
    db
  );
}

export { PAYMENT_AUDIT_PROVIDER, PAYMENT_AUDIT_TARGET_TYPE };
