import {
  GATEWAY_PAYMENT_EXCEPTIONS_FILTER,
  GATEWAY_PAYMENT_EXCEPTIONS_PURPOSE,
  GATEWAY_PAYMENT_EXCEPTIONS_STATUSES,
  type GatewayPaymentListFilter,
} from "@cashsouk/types";
import {
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  Prisma,
} from "@prisma/client";

export function gatewayPaymentExceptionsWhere(): Prisma.GatewayPaymentWhereInput {
  return {
    purpose: GATEWAY_PAYMENT_EXCEPTIONS_PURPOSE as GatewayPaymentPurpose,
    status: {
      in: [...GATEWAY_PAYMENT_EXCEPTIONS_STATUSES] as GatewayPaymentStatus[],
    },
  };
}

function resolveFilterStatuses(
  filter?: GatewayPaymentListFilter
): GatewayPaymentStatus[] | null {
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

function extraListFilterConstraints(query: {
  status?: GatewayPaymentStatus;
  purpose?: GatewayPaymentPurpose;
}): Prisma.GatewayPaymentWhereInput[] {
  const extra: Prisma.GatewayPaymentWhereInput[] = [];
  if (query.purpose) extra.push({ purpose: query.purpose });
  if (query.status) extra.push({ status: query.status });
  return extra;
}

function appendAndConstraints(
  where: Prisma.GatewayPaymentWhereInput,
  extra: Prisma.GatewayPaymentWhereInput[]
) {
  if (extra.length === 0) return;
  const existingAnd = where.AND;
  where.AND = [
    ...(Array.isArray(existingAnd) ? existingAnd : existingAnd ? [existingAnd] : []),
    ...extra,
  ];
}

export function applyGatewayPaymentListFilter(
  where: Prisma.GatewayPaymentWhereInput,
  query: {
    filter?: GatewayPaymentListFilter;
    status?: GatewayPaymentStatus;
    purpose?: GatewayPaymentPurpose;
  }
): Prisma.GatewayPaymentWhereInput {
  if (query.filter === GATEWAY_PAYMENT_EXCEPTIONS_FILTER) {
    Object.assign(where, gatewayPaymentExceptionsWhere());
    appendAndConstraints(where, extraListFilterConstraints(query));
    return where;
  }

  const filterStatuses = resolveFilterStatuses(query.filter);
  if (filterStatuses) {
    where.status = { in: filterStatuses };
  } else if (query.status) {
    where.status = query.status;
  }

  if (query.purpose) where.purpose = query.purpose;
  return where;
}
