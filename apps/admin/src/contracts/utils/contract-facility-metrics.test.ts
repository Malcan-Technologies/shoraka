import {
  formatContractFacilityNoteCount,
  getContractUtilizationAccentClass,
  getContractUtilizationProgressClass,
  parseFacilityAmount,
  resolveContractFacilityMetrics,
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
      contractDetails: { utilized_facility: "250,000" },
    });

    expect(metrics).toEqual({
      approved: 1000000,
      utilized: 250000,
      available: 750000,
      utilizationPercent: 25,
    });
  });

  it("treats missing utilization as nothing drawn", () => {
    const metrics = resolveContractFacilityMetrics({
      approvedFacility: 500000,
      contractDetails: null,
    });

    expect(metrics.utilized).toBe(0);
    expect(metrics.available).toBe(500000);
    expect(metrics.utilizationPercent).toBe(0);
  });

  it("never reports negative availability when the facility is over-utilized", () => {
    const metrics = resolveContractFacilityMetrics({
      approvedFacility: 100000,
      contractDetails: { utilized_facility: 130000 },
    });

    expect(metrics.available).toBe(0);
    expect(metrics.utilizationPercent).toBe(130);
  });

  it("omits utilization percent when there is no approved facility", () => {
    const metrics = resolveContractFacilityMetrics({
      approvedFacility: 0,
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
  it("describes how many notes have drawn on the facility", () => {
    expect(formatContractFacilityNoteCount(0)).toBe("No notes have used this line of credit");
    expect(formatContractFacilityNoteCount(1)).toBe("1 note has used this line of credit");
    expect(formatContractFacilityNoteCount(4)).toBe("4 notes have used this line of credit");
  });
});
