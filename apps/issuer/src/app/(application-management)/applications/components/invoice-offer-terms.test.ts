jest.mock("@cashsouk/ui", () => ({
  formatMoneyDisplay: (value: unknown, fallback = "—") =>
    value == null || value === "" ? fallback : String(value),
}));

import type { InvoiceFeeDisplay } from "@/lib/facility-fee-display";
import { buildInvoiceOfferMoneyRows, formatFeeRateLabel } from "./invoice-offer-money-rows";

function feeDisplay(overrides: Partial<InvoiceFeeDisplay> = {}): InvoiceFeeDisplay {
  return {
    phase: "estimated",
    mode: "grandfather",
    platformFeeAmount: null,
    platformFeeRatePercent: null,
    facilityFeeAmount: null,
    facilityFeeRatePercent: null,
    facilityFeeCollectAmount: null,
    additionalFeeCharges: [],
    netDisbursementAmount: null,
    facilityFeeFullyCollected: false,
    facilityFeeCollectionWaived: false,
    contractFacilityFeeWaived: false,
    waiverReason: null,
    estimatedFromOfferedAmount: true,
    ...overrides,
  };
}

describe("formatFeeRateLabel", () => {
  it("appends a percent when a rate is present", () => {
    expect(formatFeeRateLabel("Drawdown fee", 1)).toBe("Drawdown fee (1%)");
    expect(formatFeeRateLabel("Facility fee", 1.25)).toBe("Facility fee (1.25%)");
  });

  it("keeps the base label when the rate is missing", () => {
    expect(formatFeeRateLabel("Drawdown fee", null)).toBe("Drawdown fee");
  });
});

describe("buildInvoiceOfferMoneyRows", () => {
  it("builds requested, approved, fees, and net for a grandfather facility-linked offer", () => {
    const rows = Object.fromEntries(
      buildInvoiceOfferMoneyRows({
        requestedFinancing: 46172,
        approvedFinancing: 40740,
        includeFacilityFee: true,
        feeDisplay: feeDisplay({
          platformFeeAmount: 407.4,
          platformFeeRatePercent: 1,
          facilityFeeAmount: 0,
          facilityFeeRatePercent: 1,
          netDisbursementAmount: 40332.6,
          facilityFeeFullyCollected: true,
        }),
      }).map((row) => [row.key, row])
    );

    expect(rows.requested.amount).toBe(46172);
    expect(rows.approved.amount).toBe(40740);
    expect(rows.platform.amount).toBeCloseTo(407.4);
    expect(rows.platform.label).toBe("Drawdown fee (1%)");
    expect(rows.facility.amount).toBe(0);
    expect(rows.facility.hint).toBe("Cap already reached");
    expect(rows.net.amount).toBeCloseTo(40332.6);
    expect(rows.net.kind).toBe("net");
  });

  it("renders frozen-schedule extra lines and exact facility collection", () => {
    const rows = buildInvoiceOfferMoneyRows({
      requestedFinancing: 110_000,
      approvedFinancing: 100_000,
      includeFacilityFee: true,
      feeDisplay: feeDisplay({
        mode: "schedule",
        platformFeeAmount: 3_000,
        platformFeeRatePercent: 3,
        facilityFeeAmount: 800,
        facilityFeeCollectAmount: 800,
        additionalFeeCharges: [
          { name: "Legal fee", kind: "amount", value: 500, chargedAmount: 500 },
          { name: "Arrangement", kind: "percent_of_funded", value: 1, chargedAmount: 1_000 },
        ],
        netDisbursementAmount: 94_700,
      }),
    });
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));

    expect(byKey.platform.label).toBe("Drawdown fee (3%)");
    expect(byKey.facility.label).toBe("Facility fee");
    expect(byKey.facility.hint).toBe("Exact collection amount");
    expect(byKey.facility.amount).toBe(800);
    expect(byKey["extra-0"].label).toBe("Legal fee");
    expect(byKey["extra-0"].amount).toBe(500);
    expect(byKey["extra-1"].label).toBe("Arrangement (1%)");
    expect(byKey["extra-1"].amount).toBe(1_000);
    expect(byKey.net.hint).toBe("Estimated at full funding. Final uses actual funded.");
  });

  it("omits facility fee on invoice-only offers but keeps extra lines", () => {
    const rows = buildInvoiceOfferMoneyRows({
      requestedFinancing: 22000,
      approvedFinancing: 20000,
      includeFacilityFee: false,
      feeDisplay: feeDisplay({
        mode: "schedule",
        platformFeeAmount: 200,
        platformFeeRatePercent: 1,
        additionalFeeCharges: [{ name: "Legal fee", kind: "amount", value: 50, chargedAmount: 50 }],
        netDisbursementAmount: 19750,
      }),
    });

    expect(rows.map((row) => row.key)).toEqual([
      "requested",
      "approved",
      "platform",
      "extra-0",
      "net",
    ]);
    expect(rows.find((row) => row.key === "net")?.amount).toBe(19750);
  });
});
