import { LEFT_ON_CONTRACT_LABEL } from "@cashsouk/types";
import {
  clampMeterAriaNow,
  compactLifetimeLine,
  compactReservedLine,
  contractAllocationMeterLabel,
  creditFacilityMeterLabel,
  resolveFacilityDisplayMetrics,
  shouldShowFacilityImpact,
} from "./facility-capacity-display";

const formatMoney = (value: unknown) => `RM ${value}`;

describe("resolveFacilityDisplayMetrics", () => {
  it("lets reserved pending reduce available without mixing it into utilised", () => {
    const metrics = resolveFacilityDisplayMetrics({
      approvedFacilityAmount: "100000",
      utilizedFacilityAmount: "40000",
      pendingFacilityAmount: "15000",
      availableFacilityAmount: "45000",
      lifetimeCapAmount: "500000",
      lifetimeUsedAmount: "120000",
      lifetimeRemainingAmount: "380000",
    });
    expect(metrics.utilized).toBe(40_000);
    expect(metrics.pending).toBe(15_000);
    expect(metrics.occupied).toBe(55_000);
    expect(metrics.available).toBe(45_000);
    expect(metrics.lifetimeUsed).toBe(120_000);
    expect(metrics.lifetimeRemaining).toBe(380_000);
  });
});

describe("compact facility copy", () => {
  it("labels pending as reserved and keeps a compact lifetime line", () => {
    expect(compactReservedLine(15_000, formatMoney)).toBe("RM 15000 reserved");
    expect(compactReservedLine(0, formatMoney)).toBeNull();
    expect(
      compactLifetimeLine({ lifetimeRemaining: 380_000, lifetimeCap: 500_000 }, formatMoney)
    ).toBe(`${LEFT_ON_CONTRACT_LABEL}: RM 380000 of RM 500000`);
  });

  it("builds accessible meter labels for credit and contract allocation", () => {
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

  it("shows facility impact only for facility-backed records", () => {
    expect(shouldShowFacilityImpact("con_1")).toBe(true);
    expect(shouldShowFacilityImpact(null)).toBe(false);
    expect(shouldShowFacilityImpact("")).toBe(false);
  });

  it("clamps meter aria-valuenow when legacy usage exceeds the cap", () => {
    expect(clampMeterAriaNow(120_000, 0, 100_000)).toBe(100_000);
    expect(clampMeterAriaNow(-5, 0, 100_000)).toBe(0);
    expect(clampMeterAriaNow(40_000, 0, 100_000)).toBe(40_000);
  });
});
