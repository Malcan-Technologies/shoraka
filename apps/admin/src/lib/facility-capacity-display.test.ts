import {
  CONTRACT_ALLOCATION_LABEL,
  CREDIT_FACILITY_LABEL,
  REQUESTED_FACILITY_BELOW_CONTRACT_COPY,
  FACILITY_CAPACITY_EXCEEDED,
  CONTRACT_LIFETIME_EXCEEDED,
  FACILITY_MUST_BE_BELOW_CONTRACT_VALUE,
} from "@cashsouk/types";
import {
  compactRemainingAllocationLine,
  compactReservedLine,
  contractAllocationMeterLabel,
  CREDIT_FACILITY_HEADING,
  CONTRACT_ALLOCATION_HEADING,
  clampMeterAriaNow,
  mapAdminCapacityActionError,
  OFFERED_FACILITY_BELOW_CONTRACT_COPY,
  OVER_LIMIT_LABEL,
  OVER_LIMIT_OFFERS_BLOCKED_COPY,
  REMAINING_ALLOCATION_LABEL,
  RESERVED_LABEL,
  creditFacilityMeterLabel,
  overLimitStateLabel,
  resolveFacilityOfferBlockReason,
  resolveInvoiceOfferDisable,
  shouldShowFacilityImpact,
} from "./facility-capacity-display";

const formatMoney = (value: number) => `RM ${value}`;

describe("admin dual-limit copy", () => {
  it("labels pending as reserved and remaining allocation compactly", () => {
    expect(RESERVED_LABEL).toBe("Reserved");
    expect(compactReservedLine(15_000, formatMoney)).toBe("RM 15000 reserved");
    expect(compactReservedLine(0, formatMoney)).toBeNull();
    expect(
      compactRemainingAllocationLine(
        { lifetimeRemaining: 380_000, lifetimeCap: 500_000 },
        formatMoney
      )
    ).toBe(`${REMAINING_ALLOCATION_LABEL}: RM 380000 of RM 500000`);
    expect(CREDIT_FACILITY_HEADING).toContain(CREDIT_FACILITY_LABEL);
    expect(CREDIT_FACILITY_HEADING).toMatch(/reusable after repayment/i);
    expect(CONTRACT_ALLOCATION_HEADING).toContain(CONTRACT_ALLOCATION_LABEL);
    expect(CONTRACT_ALLOCATION_HEADING).toMatch(/used once/i);
  });

  it("builds accessible meter labels that mention repayment and settlement retention", () => {
    expect(
      creditFacilityMeterLabel({
        utilized: 40_000,
        reserved: 15_000,
        approved: 100_000,
        available: 45_000,
      })
    ).toMatch(/reserved/);
    expect(
      creditFacilityMeterLabel({
        utilized: 40_000,
        reserved: 15_000,
        approved: 100_000,
        available: 45_000,
      })
    ).toMatch(/Repayment frees credit/);
    expect(
      contractAllocationMeterLabel({
        used: 120_000,
        remaining: 380_000,
        cap: 500_000,
      })
    ).toMatch(/Settled invoices still use contract allocation/);
  });
});

describe("resolveFacilityOfferBlockReason", () => {
  it("requires requested and offered financing to be strictly below contract value", () => {
    expect(
      resolveFacilityOfferBlockReason({
        requestedFacility: 100_000,
        offeredFacility: 90_000,
        contractValue: 100_000,
      })
    ).toBe(REQUESTED_FACILITY_BELOW_CONTRACT_COPY);
    expect(
      resolveFacilityOfferBlockReason({
        requestedFacility: 80_000,
        offeredFacility: 100_000,
        contractValue: 100_000,
      })
    ).toBe(OFFERED_FACILITY_BELOW_CONTRACT_COPY);
    expect(
      resolveFacilityOfferBlockReason({
        requestedFacility: 80_000,
        offeredFacility: 79_999,
        contractValue: 100_000,
      })
    ).toBeNull();
  });
});

describe("resolveInvoiceOfferDisable", () => {
  it("disables send when offered financing exceeds remaining credit", () => {
    const result = resolveInvoiceOfferDisable({
      offeredAmount: 60_000,
      invoiceFace: 80_000,
      hasRiskRating: true,
      remainingCredit: 10_000,
      remainingAllocation: 200_000,
      invoiceStatus: "SUBMITTED",
      addBackFinancing: 40_000,
      addBackFace: 80_000,
    });
    expect(result.disabled).toBe(true);
    expect(result.reason).toBe("exceeds_credit");
    expect(result.message).toMatch(/remaining credit/i);
    expect(result.message).toMatch(/no override/i);
  });

  it("disables send when invoice face exceeds remaining allocation", () => {
    const result = resolveInvoiceOfferDisable({
      offeredAmount: 20_000,
      invoiceFace: 90_000,
      hasRiskRating: true,
      remainingCredit: 50_000,
      remainingAllocation: 80_000,
      invoiceStatus: "DRAFT",
    });
    expect(result.disabled).toBe(true);
    expect(result.reason).toBe("exceeds_allocation");
    expect(result.message).toMatch(/remaining allocation/i);
  });

  it("blocks a new offer on a legacy over-limit facility", () => {
    const result = resolveInvoiceOfferDisable({
      offeredAmount: 10_000,
      invoiceFace: 20_000,
      hasRiskRating: true,
      remainingCredit: -5_000,
      remainingAllocation: 100_000,
      invoiceStatus: "APPROVED",
      facilityOverLimit: true,
    });
    expect(result.disabled).toBe(true);
    expect(result.reason).toBe("over_limit");
    expect(result.message).toBe(OVER_LIMIT_OFFERS_BLOCKED_COPY);
  });

  it("keeps add-back on reserved applied financing so a larger face-ratio add-back cannot enable an over-limit offer", () => {
    const result = resolveInvoiceOfferDisable({
      offeredAmount: 60_000,
      invoiceFace: 100_000,
      hasRiskRating: true,
      remainingCredit: 10_000,
      remainingAllocation: 200_000,
      invoiceStatus: "SUBMITTED",
      addBackFinancing: 40_000,
      addBackFace: 100_000,
    });
    expect(result.disabled).toBe(true);
    expect(result.reason).toBe("exceeds_credit");
  });

  it("allows a reserved invoice that still fits after add-back", () => {
    const result = resolveInvoiceOfferDisable({
      offeredAmount: 40_000,
      invoiceFace: 80_000,
      hasRiskRating: true,
      remainingCredit: 10_000,
      remainingAllocation: 20_000,
      invoiceStatus: "SUBMITTED",
      addBackFinancing: 40_000,
      addBackFace: 80_000,
    });
    expect(result.disabled).toBe(false);
    expect(result.reason).toBeNull();
  });
});

describe("mapAdminCapacityActionError", () => {
  it("maps capacity codes to user-facing copy and marks refetch", () => {
    expect(
      mapAdminCapacityActionError({ code: FACILITY_CAPACITY_EXCEEDED }, "fallback").message
    ).toMatch(/left to draw/i);
    expect(
      mapAdminCapacityActionError({ error: { code: CONTRACT_LIFETIME_EXCEEDED } }, "fallback")
        .shouldRefetch
    ).toBe(true);
    expect(
      mapAdminCapacityActionError({ code: FACILITY_MUST_BE_BELOW_CONTRACT_VALUE }, "fallback")
        .message
    ).toBe(REQUESTED_FACILITY_BELOW_CONTRACT_COPY);
  });

  it("refetches on concurrent conflict and keeps the server message", () => {
    const mapped = mapAdminCapacityActionError(
      {
        code: "CONFLICT",
        message: "Facility was modified concurrently. Refresh and retry sending offer.",
      },
      "fallback"
    );
    expect(mapped.shouldRefetch).toBe(true);
    expect(mapped.message).toMatch(/concurrently/i);
  });
});

describe("over-limit and facility impact visibility", () => {
  it("exposes an explicit over-limit label", () => {
    expect(overLimitStateLabel({ isOverLimit: true })).toBe(OVER_LIMIT_LABEL);
    expect(overLimitStateLabel({ isOverLimit: false })).toBeNull();
  });

  it("clamps meter aria-valuenow when legacy usage exceeds the cap", () => {
    expect(clampMeterAriaNow(120_000, 0, 100_000)).toBe(100_000);
    expect(clampMeterAriaNow(-5, 0, 100_000)).toBe(0);
    expect(clampMeterAriaNow(40_000, 0, 100_000)).toBe(40_000);
  });

  it("shows facility impact only for facility-backed records", () => {
    expect(shouldShowFacilityImpact("con_1")).toBe(true);
    expect(shouldShowFacilityImpact(null)).toBe(false);
    expect(shouldShowFacilityImpact("")).toBe(false);
  });
});
