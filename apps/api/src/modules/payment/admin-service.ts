import {
  GatewayPaymentEventType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  NameCheckResult,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { creditCompletedDeposit, resolveInvestorExpectedName } from "./deposit-service";
import {
  getOpenOverrideProposal,
  mapGatewayPaymentEvent,
  recordGatewayPaymentEvent,
} from "./gateway-events";
import { ListGatewayPaymentsQuery } from "./admin-schemas";
import { assertTransition } from "./state";

export type AdminActorContext = {
  userId: string;
};

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

function buildInvestorOrgDisplayName(org: {
  type: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  corporate_onboarding_data: unknown;
}): string | null {
  if (org.type === "COMPANY") {
    const data = org.corporate_onboarding_data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const businessName = (data as { basicInfo?: { businessName?: string } }).basicInfo
        ?.businessName?.trim();
      if (businessName) return businessName;
    }
  }

  const parts = [org.first_name, org.middle_name, org.last_name]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function mapListItem(
  payment: Prisma.GatewayPaymentGetPayload<{
    include: { investor_organization: true };
  }>
) {
  return {
    id: payment.id,
    purpose: payment.purpose,
    organizationType: payment.organization_type,
    status: payment.status,
    amount: decimalToNumber(payment.amount),
    currency: payment.currency,
    payerName: payment.payer_name,
    nameCheckResult: payment.name_check_result,
    investorOrganizationId: payment.investor_organization_id,
    investorOrganizationName: payment.investor_organization
      ? buildInvestorOrgDisplayName(payment.investor_organization)
      : null,
    curlecOrderId: payment.curlec_order_id,
    createdAt: payment.created_at.toISOString(),
    updatedAt: payment.updated_at.toISOString(),
  };
}

async function getInvestorDepositOrThrow(
  db: PrismaClient,
  gatewayPaymentId: string
) {
  const payment = await db.gatewayPayment.findFirst({
    where: {
      id: gatewayPaymentId,
      purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
    },
    include: {
      investor_organization: true,
      events: { orderBy: { created_at: "asc" } },
    },
  });

  if (!payment) {
    throw new AppError(404, "GATEWAY_PAYMENT_NOT_FOUND", "Gateway payment not found");
  }

  return payment;
}

export async function listGatewayPayments(
  query: ListGatewayPaymentsQuery,
  db: PrismaClient = defaultPrisma
) {
  const where: Prisma.GatewayPaymentWhereInput = {};

  if (query.queue === "held") {
    where.status = { in: [GatewayPaymentStatus.HELD, GatewayPaymentStatus.NAME_CHECK_PENDING] };
  } else if (query.status) {
    where.status = query.status;
  }

  if (query.purpose) where.purpose = query.purpose;
  if (query.organizationType) where.organization_type = query.organizationType;

  if (query.search) {
    where.OR = [
      { id: { contains: query.search, mode: "insensitive" } },
      { curlec_order_id: { contains: query.search, mode: "insensitive" } },
      { curlec_payment_id: { contains: query.search, mode: "insensitive" } },
      { payer_name: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const skip = (query.page - 1) * query.pageSize;

  const [total, items] = await Promise.all([
    db.gatewayPayment.count({ where }),
    db.gatewayPayment.findMany({
      where,
      include: { investor_organization: true },
      orderBy: { created_at: "desc" },
      skip,
      take: query.pageSize,
    }),
  ]);

  return {
    items: items.map(mapListItem),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getHeldGatewayPaymentsPendingCount(db: PrismaClient = defaultPrisma) {
  const count = await db.gatewayPayment.count({
    where: {
      purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
      status: { in: [GatewayPaymentStatus.HELD, GatewayPaymentStatus.NAME_CHECK_PENDING] },
    },
  });

  return { count };
}

export async function getGatewayPaymentDetail(
  gatewayPaymentId: string,
  db: PrismaClient = defaultPrisma
) {
  const payment = await getInvestorDepositOrThrow(db, gatewayPaymentId);
  const openOverride = await getOpenOverrideProposal(db, payment.id);

  return {
    ...mapListItem(payment),
    curlecPaymentId: payment.curlec_payment_id,
    method: payment.method,
    bankCode: payment.bank_code,
    expectedPayerName: payment.investor_organization
      ? resolveInvestorExpectedName(payment.investor_organization)
      : null,
    nameCheckAt: payment.name_check_at?.toISOString() ?? null,
    nameCheckedByUserId: payment.name_checked_by_user_id,
    refundReference: payment.refund_reference,
    refundInitiatedBy: payment.refund_initiated_by,
    refundedAt: payment.refunded_at?.toISOString() ?? null,
    refundNotes: payment.refund_notes,
    openOverrideProposedBy: openOverride?.proposedByUserId ?? null,
    openOverrideReason: openOverride?.reason ?? null,
    events: payment.events.map(mapGatewayPaymentEvent),
  };
}

export async function approveNameCheckPendingDeposit(
  actor: AdminActorContext,
  gatewayPaymentId: string,
  reason: string,
  db: PrismaClient = defaultPrisma
) {
  const payment = await getInvestorDepositOrThrow(db, gatewayPaymentId);

  if (payment.status !== GatewayPaymentStatus.NAME_CHECK_PENDING) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_STATUS",
      "Name check approval is only allowed for NAME_CHECK_PENDING payments"
    );
  }

  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assertTransition(current.status, GatewayPaymentStatus.COMPLETED);
    await creditCompletedDeposit(tx, current, {
      nameCheckResult: NameCheckResult.PASS,
      actorUserId: actor.userId,
    });
    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: payment.id,
      type: GatewayPaymentEventType.NAME_CHECK_APPROVED,
      actorUserId: actor.userId,
      fromStatus: GatewayPaymentStatus.NAME_CHECK_PENDING,
      toStatus: GatewayPaymentStatus.COMPLETED,
      reason,
    });
  });

  return getGatewayPaymentDetail(gatewayPaymentId, db);
}

export async function rejectNameCheckPendingDeposit(
  actor: AdminActorContext,
  gatewayPaymentId: string,
  reason: string,
  db: PrismaClient = defaultPrisma
) {
  const payment = await getInvestorDepositOrThrow(db, gatewayPaymentId);

  if (payment.status !== GatewayPaymentStatus.NAME_CHECK_PENDING) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_STATUS",
      "Name check rejection is only allowed for NAME_CHECK_PENDING payments"
    );
  }

  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assertTransition(current.status, GatewayPaymentStatus.HELD);
    await tx.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.HELD,
        name_check_result: NameCheckResult.FAIL,
        name_check_at: new Date(),
        name_checked_by_user_id: actor.userId,
      },
    });
    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: payment.id,
      type: GatewayPaymentEventType.NAME_CHECK_REJECTED,
      actorUserId: actor.userId,
      fromStatus: GatewayPaymentStatus.NAME_CHECK_PENDING,
      toStatus: GatewayPaymentStatus.HELD,
      reason,
    });
  });

  return getGatewayPaymentDetail(gatewayPaymentId, db);
}

export async function proposeHeldDepositOverride(
  actor: AdminActorContext,
  gatewayPaymentId: string,
  reason: string,
  db: PrismaClient = defaultPrisma
) {
  const payment = await getInvestorDepositOrThrow(db, gatewayPaymentId);

  if (payment.status !== GatewayPaymentStatus.HELD) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_STATUS",
      "Override proposal is only allowed for HELD payments"
    );
  }

  const openProposal = await getOpenOverrideProposal(db, payment.id);
  if (openProposal) {
    throw new AppError(
      409,
      "OVERRIDE_PROPOSAL_OPEN",
      "An override proposal is already pending approval"
    );
  }

  await recordGatewayPaymentEvent(db, {
    gatewayPaymentId: payment.id,
    type: GatewayPaymentEventType.OVERRIDE_PROPOSED,
    actorUserId: actor.userId,
    fromStatus: payment.status,
    toStatus: null,
    reason,
  });

  return getGatewayPaymentDetail(gatewayPaymentId, db);
}

export async function approveHeldDepositOverride(
  actor: AdminActorContext,
  gatewayPaymentId: string,
  db: PrismaClient = defaultPrisma
) {
  const payment = await getInvestorDepositOrThrow(db, gatewayPaymentId);

  if (payment.status !== GatewayPaymentStatus.HELD) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_STATUS",
      "Override approval is only allowed for HELD payments"
    );
  }

  const openProposal = await getOpenOverrideProposal(db, payment.id);
  if (!openProposal) {
    throw new AppError(422, "OVERRIDE_PROPOSAL_MISSING", "No open override proposal to approve");
  }

  if (openProposal.proposedByUserId === actor.userId) {
    throw new AppError(
      403,
      "OVERRIDE_SELF_APPROVAL",
      "The checker must differ from the maker who proposed the override"
    );
  }

  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assertTransition(current.status, GatewayPaymentStatus.COMPLETED);
    await creditCompletedDeposit(tx, current, {
      nameCheckResult: NameCheckResult.PASS,
      actorUserId: actor.userId,
    });
    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: payment.id,
      type: GatewayPaymentEventType.OVERRIDE_APPROVED,
      actorUserId: actor.userId,
      fromStatus: GatewayPaymentStatus.HELD,
      toStatus: GatewayPaymentStatus.COMPLETED,
      reason: openProposal.reason,
      metadata: { proposedByUserId: openProposal.proposedByUserId },
    });
  });

  return getGatewayPaymentDetail(gatewayPaymentId, db);
}

export async function rejectHeldDepositOverride(
  actor: AdminActorContext,
  gatewayPaymentId: string,
  reason: string,
  db: PrismaClient = defaultPrisma
) {
  const payment = await getInvestorDepositOrThrow(db, gatewayPaymentId);

  if (payment.status !== GatewayPaymentStatus.HELD) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_STATUS",
      "Override rejection is only allowed for HELD payments"
    );
  }

  const openProposal = await getOpenOverrideProposal(db, payment.id);
  if (!openProposal) {
    throw new AppError(422, "OVERRIDE_PROPOSAL_MISSING", "No open override proposal to reject");
  }

  await recordGatewayPaymentEvent(db, {
    gatewayPaymentId: payment.id,
    type: GatewayPaymentEventType.OVERRIDE_REJECTED,
    actorUserId: actor.userId,
    fromStatus: payment.status,
    toStatus: null,
    reason,
    metadata: { proposedByUserId: openProposal.proposedByUserId },
  });

  return getGatewayPaymentDetail(gatewayPaymentId, db);
}

export async function recordGatewayRefundInitiated(
  actor: AdminActorContext,
  gatewayPaymentId: string,
  input: { reference: string; notes?: string },
  db: PrismaClient = defaultPrisma
) {
  const payment = await getInvestorDepositOrThrow(db, gatewayPaymentId);

  if (
    payment.status !== GatewayPaymentStatus.HELD &&
    payment.status !== GatewayPaymentStatus.COMPLETED
  ) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_STATUS",
      "Refund recording is only allowed for HELD or COMPLETED payments"
    );
  }

  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assertTransition(current.status, GatewayPaymentStatus.REFUND_INITIATED);
    await tx.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.REFUND_INITIATED,
        refund_reference: input.reference,
        refund_initiated_by: actor.userId,
        refund_notes: input.notes ?? null,
      },
    });
    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: payment.id,
      type: GatewayPaymentEventType.REFUND_INITIATED,
      actorUserId: actor.userId,
      fromStatus: current.status,
      toStatus: GatewayPaymentStatus.REFUND_INITIATED,
      reason: input.notes ?? null,
      metadata: { reference: input.reference },
    });
  });

  return getGatewayPaymentDetail(gatewayPaymentId, db);
}

export async function recordGatewayRefundCompleted(
  actor: AdminActorContext,
  gatewayPaymentId: string,
  input: { notes?: string },
  db: PrismaClient = defaultPrisma
) {
  const payment = await getInvestorDepositOrThrow(db, gatewayPaymentId);

  if (payment.status !== GatewayPaymentStatus.REFUND_INITIATED) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_STATUS",
      "Refund completion is only allowed for REFUND_INITIATED payments"
    );
  }

  await db.$transaction(async (tx) => {
    const current = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assertTransition(current.status, GatewayPaymentStatus.REFUNDED);
    await tx.gatewayPayment.update({
      where: { id: payment.id },
      data: {
        status: GatewayPaymentStatus.REFUNDED,
        refunded_at: new Date(),
        refund_notes: input.notes ?? current.refund_notes,
      },
    });
    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: payment.id,
      type: GatewayPaymentEventType.REFUNDED,
      actorUserId: actor.userId,
      fromStatus: GatewayPaymentStatus.REFUND_INITIATED,
      toStatus: GatewayPaymentStatus.REFUNDED,
      reason: input.notes ?? null,
    });
  });

  return getGatewayPaymentDetail(gatewayPaymentId, db);
}
