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
import {
  creditCompletedDeposit,
  resolveInvestorExpectedName,
} from "./deposit-service";
import { recordGatewayPaymentEvent, mapGatewayPaymentEvent } from "./gateway-events";
import { ListGatewayPaymentsQuery } from "./admin-schemas";
import { initiateInvestorDepositRefund } from "./refund-service";

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

function resolveFilterStatuses(filter?: ListGatewayPaymentsQuery["filter"]) {
  switch (filter) {
    case "needs_attention":
      return [GatewayPaymentStatus.HELD];
    case "review":
      return [GatewayPaymentStatus.NAME_CHECK_PENDING];
    case "refunding":
      return [GatewayPaymentStatus.REFUND_INITIATED];
    case "refunded":
      return [GatewayPaymentStatus.REFUNDED];
    case "completed":
      return [GatewayPaymentStatus.COMPLETED];
    default:
      return null;
  }
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

async function getGatewayPaymentOrThrow(
  db: PrismaClient,
  gatewayPaymentId: string
) {
  const payment = await db.gatewayPayment.findFirst({
    where: { id: gatewayPaymentId },
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
  const filterStatuses = resolveFilterStatuses(query.filter);

  if (filterStatuses) {
    where.status = { in: filterStatuses };
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

export async function getGatewayPaymentsExceptionCount(db: PrismaClient = defaultPrisma) {
  const count = await db.gatewayPayment.count({
    where: {
      purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
      status: {
        in: [GatewayPaymentStatus.HELD, GatewayPaymentStatus.NAME_CHECK_PENDING],
      },
    },
  });

  return { count };
}

export async function getGatewayPaymentDetail(
  gatewayPaymentId: string,
  db: PrismaClient = defaultPrisma
) {
  const payment = await getGatewayPaymentOrThrow(db, gatewayPaymentId);

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
    openOverrideProposedBy: null,
    openOverrideReason: null,
    events: payment.events.map(mapGatewayPaymentEvent),
  };
}

export async function retryHeldDepositRefund(
  actor: AdminActorContext,
  gatewayPaymentId: string,
  db: PrismaClient = defaultPrisma
) {
  const payment = await getInvestorDepositOrThrow(db, gatewayPaymentId);

  if (payment.status !== GatewayPaymentStatus.HELD) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_STATUS",
      "Retry refund is only allowed for HELD payments"
    );
  }

  if (!payment.curlec_payment_id) {
    throw new AppError(
      422,
      "GATEWAY_PAYMENT_INVALID",
      "Held payment is missing Curlec payment id"
    );
  }

  await initiateInvestorDepositRefund(
    payment,
    {
      reason: "ADMIN_INITIATED",
      curlecPaymentId: payment.curlec_payment_id,
      actorUserId: actor.userId,
      adminReason: "Admin retry refund for held deposit",
    },
    db
  );

  return getGatewayPaymentDetail(gatewayPaymentId, db);
}

export async function initiateCompletedDepositRefund(
  actor: AdminActorContext,
  gatewayPaymentId: string,
  reason: string,
  db: PrismaClient = defaultPrisma
) {
  const payment = await getInvestorDepositOrThrow(db, gatewayPaymentId);

  if (payment.status !== GatewayPaymentStatus.COMPLETED) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_STATUS",
      "Manual refund is only allowed for COMPLETED investor deposits"
    );
  }

  if (!payment.curlec_payment_id) {
    throw new AppError(
      422,
      "GATEWAY_PAYMENT_INVALID",
      "Completed payment is missing Curlec payment id"
    );
  }

  await initiateInvestorDepositRefund(
    payment,
    {
      reason: "ADMIN_INITIATED",
      curlecPaymentId: payment.curlec_payment_id,
      actorUserId: actor.userId,
      adminReason: reason,
    },
    db
  );

  return getGatewayPaymentDetail(gatewayPaymentId, db);
}

export async function approveNameCheck(
  actor: AdminActorContext,
  gatewayPaymentId: string,
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
    });
  });

  return getGatewayPaymentDetail(gatewayPaymentId, db);
}

export async function rejectNameCheck(
  actor: AdminActorContext,
  gatewayPaymentId: string,
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

  if (!payment.curlec_payment_id) {
    throw new AppError(
      422,
      "GATEWAY_PAYMENT_INVALID",
      "Payment is missing Curlec payment id"
    );
  }

  await db.$transaction(async (tx) => {
    await recordGatewayPaymentEvent(tx, {
      gatewayPaymentId: payment.id,
      type: GatewayPaymentEventType.NAME_CHECK_REJECTED,
      actorUserId: actor.userId,
      fromStatus: GatewayPaymentStatus.NAME_CHECK_PENDING,
      toStatus: GatewayPaymentStatus.REFUND_INITIATED,
      reason: "Admin rejected name check",
    });
  });

  await initiateInvestorDepositRefund(
    payment,
    {
      reason: "ADMIN_INITIATED",
      curlecPaymentId: payment.curlec_payment_id,
      actorUserId: actor.userId,
      adminReason: "Admin rejected name check",
    },
    db
  );

  return getGatewayPaymentDetail(gatewayPaymentId, db);
}
