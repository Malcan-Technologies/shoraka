jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import { CAPACITY_SNAPSHOT_VERSION, CAPACITY_SNAPSHOT_VERSION_KEY } from "@cashsouk/types";
import {
  formatContractFacilityNoteCount,
  getContractUtilizationAccentClass,
  getContractUtilizationProgressClass,
  parseFacilityAmount,
  resolveAdminReviewFacilityOccupancy,
  canWaiveContractFacilityFee,
  resolveContractFacilityFeeCollected,
  resolveContractFacilityFeeLedger,
  resolveContractFacilityMetrics,
  resolvePendingFacilityFromSnapshot,
  sumPendingInvoiceFacility,
} from "./contract-facility-metrics";

describe("parseFacilityAmount", () => {
  it("accepts finite numbers only", () => {
    expect(parseFacilityAmount(1500)).toBe(1500);
    expect(parseFacilityAmount(0)).toBe(0);
    expect(parseFacilityAmount(Number.NaN)).toBeNull();
    expect(parseFacilityAmount(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("parses formatted strings from the contract JSON", () => {
    expect(parseFacilityAmount("1250000")).toBe(1250000);
    expect(parseFacilityAmount("1,250,000.50")).toBe(1250000.5);
    expect(parseFacilityAmount("RM 1,250,000.00")).toBe(1250000);
    expect(parseFacilityAmount(" 900 ")).toBe(900);
  });

  it("returns null for values that are not amounts", () => {
    expect(parseFacilityAmount(null)).toBeNull();
    expect(parseFacilityAmount(undefined)).toBeNull();
    expect(parseFacilityAmount("")).toBeNull();
    expect(parseFacilityAmount("not a number")).toBeNull();
    expect(parseFacilityAmount("1.2.3")).toBeNull();
    expect(parseFacilityAmount(true)).toBeNull();
    expect(parseFacilityAmount({ amount: 5 })).toBeNull();
  });
});

describe("resolveContractFacilityMetrics", () => {
  it("derives available facility and utilization from the contract JSON", () => {
    const metrics = resolveContractFacilityMetrics({
      approvedFacility: 1000000,
      status: "APPROVED",
      contractDetails: { utilized_facility: "250,000" },
    });

    expect(metrics.approved).toBe(1000000);
    expect(metrics.utilized).toBe(250000);
    expect(metrics.pending).toBe(0);
    expect(metrics.available).toBe(750000);
    expect(metrics.occupied).toBe(250000);
    expect(metrics.utilizationPercent).toBe(25);
    expect(metrics.isOverLimit).toBe(false);
  });

  it("treats missing utilization as nothing drawn", () => {
    const metrics = resolveContractFacilityMetrics({
      approvedFacility: 500000,
      status: "APPROVED",
      contractDetails: null,
    });

    expect(metrics.utilized).toBe(0);
    expect(metrics.available).toBe(500000);
    expect(metrics.utilizationPercent).toBe(0);
  });

  it("reports negative availability when the facility is overdrawn", () => {
    const metrics = resolveContractFacilityMetrics({
      approvedFacility: 100000,
      status: "APPROVED",
      contractDetails: { utilized_facility: 130000, available_facility: -30000 },
    });

    expect(metrics.available).toBe(-30000);
    expect(metrics.utilizationPercent).toBe(130);
  });

  it("treats pending as reserved credit that reduces remaining", () => {
    const metrics = resolveContractFacilityMetrics({
      approvedFacility: 100000,
      status: "APPROVED",
      contractDetails: { utilized_facility: 0, pending_facility: 46172 },
    });
    expect(metrics.pending).toBe(46172);
    expect(metrics.available).toBe(53828);
    expect(metrics.occupied).toBe(46172);
    expect(metrics.utilizationPercent).toBeCloseTo(46.172);
  });

  it("prefers typed snapshot fields and preserves legacy negative remaining", () => {
    const metrics = resolveContractFacilityMetrics({
      approvedFacility: 100000,
      utilizedFacility: 80000,
      pendingFacility: 30000,
      availableFacility: -10000,
      lifetimeCap: 400000,
      lifetimeUsed: 410000,
      lifetimeRemaining: -10000,
      status: "APPROVED",
      contractDetails: {
        utilized_facility: 1,
        pending_facility: 1,
        available_facility: 99,
        lifetime_remaining: 1,
      },
    });
    expect(metrics.utilized).toBe(80000);
    expect(metrics.pending).toBe(30000);
    expect(metrics.available).toBe(-10000);
    expect(metrics.lifetimeRemaining).toBe(-10000);
    expect(metrics.isCreditOverLimit).toBe(true);
    expect(metrics.isAllocationOverLimit).toBe(true);
    expect(metrics.isOverLimit).toBe(true);
  });

  it("reads lifetime allocation from contract JSON when typed fields are absent", () => {
    const metrics = resolveContractFacilityMetrics({
      approvedFacility: 100000,
      status: "APPROVED",
      contractDetails: {
        utilized_facility: 20000,
        lifetime_cap: 500000,
        lifetime_used: 120000,
        lifetime_remaining: 380000,
      },
    });
    expect(metrics.lifetimeCap).toBe(500000);
    expect(metrics.lifetimeUsed).toBe(120000);
    expect(metrics.lifetimeRemaining).toBe(380000);
    expect(metrics.allocationPercent).toBe(24);
  });

  it("reads approved_facility from JSON when the payload number is missing or zero", () => {
    const metrics = resolveContractFacilityMetrics({
      approvedFacility: 0,
      status: "APPROVED",
      contractDetails: { approved_facility: "100,000", utilized_facility: "20,000" },
    });
    expect(metrics.approved).toBe(100000);
    expect(metrics.utilized).toBe(20000);
    expect(metrics.available).toBe(80000);
    expect(metrics.utilizationPercent).toBe(20);
  });

  it("does not revive a stored approved line after the offer is retracted", () => {
    const metrics = resolveContractFacilityMetrics({
      approvedFacility: 0,
      status: "SUBMITTED",
      contractDetails: { approved_facility: 100000, utilized_facility: 0 },
    });
    expect(metrics.approved).toBe(0);
    expect(metrics.available).toBe(0);
    expect(metrics.utilizationPercent).toBeNull();
  });

  it("omits utilization percent when there is no approved facility", () => {
    const metrics = resolveContractFacilityMetrics({
      approvedFacility: 0,
      status: "APPROVED",
      contractDetails: { utilized_facility: 0 },
    });

    expect(metrics.approved).toBe(0);
    expect(metrics.utilizationPercent).toBeNull();
  });
});

describe("getContractUtilizationProgressClass", () => {
  it("uses submitted blue while drawing, green at 100%, and rejected when overdrawn", () => {
    expect(getContractUtilizationProgressClass(null, false)).toBe("bg-muted");
    expect(getContractUtilizationProgressClass(25, true)).toContain("bg-status-submitted-text");
    expect(getContractUtilizationProgressClass(100, true)).toContain("bg-status-success-text");
    expect(getContractUtilizationProgressClass(130, true)).toContain("bg-status-rejected-text");
  });
});

describe("getContractUtilizationAccentClass", () => {
  it("matches the bar token for copy colour", () => {
    expect(getContractUtilizationAccentClass(null, false)).toBeUndefined();
    expect(getContractUtilizationAccentClass(25, true)).toBe("text-status-submitted-text");
    expect(getContractUtilizationAccentClass(100, true)).toBe("text-status-success-text");
    expect(getContractUtilizationAccentClass(130, true)).toBe("text-status-rejected-text");
  });
});

describe("formatContractFacilityNoteCount", () => {
  it("describes how many drawdowns have used the facility", () => {
    expect(formatContractFacilityNoteCount(0)).toBe("No drawdowns have used this line of credit");
    expect(formatContractFacilityNoteCount(1)).toBe("1 drawdown has used this line of credit");
    expect(formatContractFacilityNoteCount(4)).toBe("4 drawdowns have used this line of credit");
  });
});

describe("sumPendingInvoiceFacility", () => {
  it("includes pre-approval amendment invoices in display-only pending", () => {
    expect(
      sumPendingInvoiceFacility([
        { status: "SUBMITTED", offer_details: { offered_amount: 10_000 } },
        { status: "AMENDMENT_REQUESTED", offer_details: { offered_amount: 20_000 } },
        { status: "APPROVED", offer_details: { offered_amount: 30_000 } },
      ])
    ).toBe(30_000);
  });

  it("uses requested applied_financing for submitted invoices", () => {
    expect(
      sumPendingInvoiceFacility([
        {
          status: "SUBMITTED",
          details: { value: 100_000, applied_financing: 40_000, financing_ratio_percent: 80 },
          offer_details: { offered_amount: 55_000 },
        },
      ])
    ).toBe(40_000);
  });
});

describe("resolvePendingFacilityFromSnapshot", () => {
  it("prefers a marked pending snapshot including zero", () => {
    expect(
      resolvePendingFacilityFromSnapshot(
        {
          pending_facility: 0,
          available_facility: 100_000,
          [CAPACITY_SNAPSHOT_VERSION_KEY]: CAPACITY_SNAPSHOT_VERSION,
        },
        [{ status: "SUBMITTED", details: { applied_financing: 40_000 } }]
      )
    ).toBe(0);
  });

  it("falls back to applied_financing when the pending snapshot is absent", () => {
    expect(
      resolvePendingFacilityFromSnapshot({ value: 500_000, approved_facility: 100_000 }, [
        { status: "SUBMITTED", details: { value: 100_000, applied_financing: 40_000 } },
      ])
    ).toBe(40_000);
  });

  it("falls back when unmarked pending is a typed zero", () => {
    expect(
      resolvePendingFacilityFromSnapshot({ pending_facility: 0, available_facility: 100_000 }, [
        { status: "SUBMITTED", details: { applied_financing: 40_000 } },
      ])
    ).toBe(40_000);
  });
});

describe("resolveAdminReviewFacilityOccupancy", () => {
  const pendingInvoice = { status: "SUBMITTED", details: { applied_financing: 40_000 } };

  it("adjusts unmarked legacy available by fallback pending", () => {
    const occupancy = resolveAdminReviewFacilityOccupancy({
      contractDetails: { value: 500_000, approved_facility: 100_000, available_facility: 100_000 },
      invoices: [pendingInvoice],
      approvedFacility: 100_000,
      utilizedFacility: 0,
    });
    expect(occupancy.pendingFacility).toBe(40_000);
    expect(occupancy.availableFacility).toBe(60_000);
  });

  it("uses marked pending=0 and available exactly", () => {
    const occupancy = resolveAdminReviewFacilityOccupancy({
      contractDetails: {
        pending_facility: 0,
        available_facility: 100_000,
        [CAPACITY_SNAPSHOT_VERSION_KEY]: CAPACITY_SNAPSHOT_VERSION,
      },
      invoices: [pendingInvoice],
      approvedFacility: 100_000,
      utilizedFacility: 0,
    });
    expect(occupancy.pendingFacility).toBe(0);
    expect(occupancy.availableFacility).toBe(100_000);
  });

  it("does not add back the current invoice when reducing legacy remaining", () => {
    const occupancy = resolveAdminReviewFacilityOccupancy({
      contractDetails: { available_facility: 80_000 },
      invoices: [
        { status: "SUBMITTED", details: { applied_financing: 40_000 } },
        { status: "SUBMITTED", details: { applied_financing: 20_000 } },
      ],
      approvedFacility: 100_000,
      utilizedFacility: 0,
    });
    expect(occupancy.pendingFacility).toBe(60_000);
    expect(occupancy.availableFacility).toBe(20_000);
  });
});

describe("resolveContractFacilityFeeCollected", () => {
  it("formats paid versus the rate cap on the approved line", () => {
    expect(
      resolveContractFacilityFeeCollected({
        approved: 100_000,
        facilityFeeRatePercent: 1,
        facilityFeePaidAmount: 1000,
      })
    ).toEqual({
      paid: 1000,
      cap: 1000,
      display: "RM 1,000.00 / RM 1,000.00 cap",
    });
  });

  it("returns null when the rate or paid amount is missing", () => {
    expect(
      resolveContractFacilityFeeCollected({
        approved: 100_000,
        facilityFeeRatePercent: 1,
        facilityFeePaidAmount: null,
      })
    ).toBeNull();
  });
});

describe("resolveContractFacilityFeeLedger", () => {
  it("reports owed, charged, waived, remaining, and enabled status", () => {
    const ledger = resolveContractFacilityFeeLedger({
      approved: 100_000,
      contractDetails: {
        facility_fee_rate_percent: 1,
        facility_fee_paid_amount: 300,
        facility_fee_waived: false,
        facility_enabled: true,
      },
    });
    expect(ledger).toMatchObject({
      owed: 1_000,
      charged: 300,
      waived: 0,
      remaining: 700,
      enabled: true,
      waivedAtContract: false,
    });
    expect(canWaiveContractFacilityFee(ledger)).toBe(true);
  });

  it("zeros remaining after a full remaining waiver and reports disable reason", () => {
    const ledger = resolveContractFacilityFeeLedger({
      approved: 100_000,
      contractDetails: {
        facility_fee_rate_percent: 1,
        facility_fee_paid_amount: 200,
        facility_fee_waived: true,
        facility_fee_waived_amount: 800,
        facility_enabled: false,
        facility_disabled_reason: "Paused for review",
      },
    });
    expect(ledger.remaining).toBe(0);
    expect(ledger.waived).toBe(800);
    expect(ledger.enabled).toBe(false);
    expect(ledger.disabledReason).toBe("Paused for review");
    expect(canWaiveContractFacilityFee(ledger)).toBe(false);
  });
});
