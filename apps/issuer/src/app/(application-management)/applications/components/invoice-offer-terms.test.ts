import type { InvoiceFeeDisplay } from "@/lib/facility-fee-display";
import { buildInvoiceOfferMoneyRows, formatFeeRateLabel } from "./invoice-offer-money-rows";

function feeDisplay(overrides: Partial<InvoiceFeeDisplay> = {}): InvoiceFeeDisplay {
  return {
    phase: "estimated",
    platformFeeAmount: null,
    platformFeeRatePercent: null,
    facilityFeeAmount: null,
    facilityFeeRatePercent: null,
    netDisbursementAmount: null,
    facilityFeeFullyCollected: false,
    ...overrides,
  };
}

describe("formatFeeRateLabel", () => {
  it("appends a percent when a rate is present", () => {
    expect(formatFeeRateLabel("Platform fee", 1)).toBe("Platform fee (1%)");
    expect(formatFeeRateLabel("Facility fee", 1.25)).toBe("Facility fee (1.25%)");
  });

  it("keeps the base label when the rate is missing", () => {
    expect(formatFeeRateLabel("Platform fee", null)).toBe("Platform fee");
  });
});

describe("buildInvoiceOfferMoneyRows", () => {
  it("builds requested, approved, fees, and net for a facility-linked invoice offer", () => {
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
    expect(rows.platform.label).toBe("Platform fee (1%)");
    expect(rows.facility.amount).toBe(0);
    expect(rows.facility.hint).toBe("Cap already reached");
    expect(rows.net.amount).toBeCloseTo(40332.6);
    expect(rows.net.kind).toBe("net");
  });

  it("omits facility fee on invoice-only offers", () => {
    const rows = buildInvoiceOfferMoneyRows({
      requestedFinancing: 22000,
      approvedFinancing: 20000,
      includeFacilityFee: false,
      feeDisplay: feeDisplay({
        platformFeeAmount: 200,
        platformFeeRatePercent: 1,
        netDisbursementAmount: 19800,
      }),
    });

    expect(rows.map((row) => row.key)).toEqual(["requested", "approved", "platform", "net"]);
    expect(rows.find((row) => row.key === "net")?.amount).toBe(19800);
  });
});
