jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import {
  formatContractFacilityNoteCount,
  getContractUtilizationAccentClass,
  getContractUtilizationProgressClass,
  parseFacilityAmount,
  resolveContractFacilityFeeCollected,
  resolveContractFacilityMetrics,
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

    expect(metrics).toEqual({
      approved: 1000000,
      utilized: 250000,
      pending: 0,
      available: 750000,
      utilizationPercent: 25,
    });
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

  it("reads pending occupancy from the contract JSON", () => {
    const metrics = resolveContractFacilityMetrics({
      approvedFacility: 100000,
      status: "APPROVED",
      contractDetails: { utilized_facility: 0, pending_facility: 46172 },
    });
    expect(metrics.pending).toBe(46172);
    expect(metrics.available).toBe(100000);
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
