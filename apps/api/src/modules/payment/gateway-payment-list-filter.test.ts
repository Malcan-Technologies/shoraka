import {
  GATEWAY_PAYMENT_EXCEPTIONS_FILTER,
  isGatewayPaymentException,
} from "@cashsouk/types";
import {
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  Prisma,
} from "@prisma/client";
import {
  applyGatewayPaymentListFilter,
  gatewayPaymentExceptionsWhere,
} from "./gateway-payment-list-filter";

describe("gateway payment list filter", () => {
  it("uses one canonical exceptions predicate for investor deposits HELD or NAME_CHECK_PENDING", () => {
    const where = gatewayPaymentExceptionsWhere();
    expect(where.purpose).toBe(GatewayPaymentPurpose.INVESTOR_DEPOSIT);
    expect(where.status).toEqual({
      in: [GatewayPaymentStatus.HELD, GatewayPaymentStatus.NAME_CHECK_PENDING],
    });
  });

  it("applies the same exceptions WHERE as the matcher for mixed purposes and statuses", () => {
    const rows = [
      { purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT, status: GatewayPaymentStatus.HELD },
      {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        status: GatewayPaymentStatus.NAME_CHECK_PENDING,
      },
      { purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT, status: GatewayPaymentStatus.COMPLETED },
      { purpose: GatewayPaymentPurpose.FACILITY_FEE, status: GatewayPaymentStatus.HELD },
      {
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        status: GatewayPaymentStatus.NAME_CHECK_PENDING,
      },
    ];

    const where = applyGatewayPaymentListFilter({}, { filter: GATEWAY_PAYMENT_EXCEPTIONS_FILTER });
    const matched = rows.filter(
      (row) =>
        row.purpose === where.purpose &&
        typeof where.status === "object" &&
        where.status !== null &&
        "in" in where.status &&
        Array.isArray(where.status.in) &&
        where.status.in.includes(row.status)
    );

    expect(matched).toEqual(rows.filter(isGatewayPaymentException));
  });

  it("keeps needs_attention as HELD-only and review as NAME_CHECK_PENDING-only", () => {
    expect(applyGatewayPaymentListFilter({}, { filter: "needs_attention" })).toEqual({
      status: { in: [GatewayPaymentStatus.HELD] },
    });
    expect(applyGatewayPaymentListFilter({}, { filter: "review" })).toEqual({
      status: { in: [GatewayPaymentStatus.NAME_CHECK_PENDING] },
    });
  });

  it("ANDs extra purpose and status onto exceptions without replacing membership", () => {
    const where: Prisma.GatewayPaymentWhereInput = {};
    applyGatewayPaymentListFilter(where, {
      filter: GATEWAY_PAYMENT_EXCEPTIONS_FILTER,
      purpose: GatewayPaymentPurpose.FACILITY_FEE,
      status: GatewayPaymentStatus.COMPLETED,
    });
    expect(where).toEqual({
      ...gatewayPaymentExceptionsWhere(),
      AND: [
        { purpose: GatewayPaymentPurpose.FACILITY_FEE },
        { status: GatewayPaymentStatus.COMPLETED },
      ],
    });
  });

  it("keeps badge parity when filter=exceptions has no extra constraints", () => {
    expect(applyGatewayPaymentListFilter({}, { filter: GATEWAY_PAYMENT_EXCEPTIONS_FILTER })).toEqual(
      gatewayPaymentExceptionsWhere()
    );
  });

  it("returns no rows for exceptions combined with a conflicting purpose", () => {
    const rows = [
      { purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT, status: GatewayPaymentStatus.HELD },
      {
        purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
        status: GatewayPaymentStatus.NAME_CHECK_PENDING,
      },
      { purpose: GatewayPaymentPurpose.FACILITY_FEE, status: GatewayPaymentStatus.HELD },
    ];

    const exceptionsOnly = applyGatewayPaymentListFilter(
      {},
      { filter: GATEWAY_PAYMENT_EXCEPTIONS_FILTER }
    );
    expect(rows.filter((row) => matchesWhere(row, exceptionsOnly))).toEqual(
      rows.filter(isGatewayPaymentException)
    );

    const exceptionsAndFacilityFee = applyGatewayPaymentListFilter(
      {},
      {
        filter: GATEWAY_PAYMENT_EXCEPTIONS_FILTER,
        purpose: GatewayPaymentPurpose.FACILITY_FEE,
      }
    );
    expect(rows.filter((row) => matchesWhere(row, exceptionsAndFacilityFee))).toEqual([]);
  });
});

function matchesWhere(
  row: { purpose: GatewayPaymentPurpose; status: GatewayPaymentStatus },
  where: Prisma.GatewayPaymentWhereInput
): boolean {
  if (where.purpose && row.purpose !== where.purpose) return false;
  if (
    where.status &&
    typeof where.status === "object" &&
    where.status !== null &&
    "in" in where.status &&
    Array.isArray(where.status.in) &&
    !where.status.in.includes(row.status)
  ) {
    return false;
  }
  if (typeof where.status === "string" && row.status !== where.status) return false;
  if (Array.isArray(where.AND) && !where.AND.every((clause) => matchesWhere(row, clause))) {
    return false;
  }
  return true;
}
