jest.mock("@cashsouk/ui", () => ({
  formatMoneyDisplay: (value: unknown, fallback = "—") =>
    value == null || value === "" ? fallback : String(value),
}));

import { buildInvoiceFeeDisplay } from "./facility-fee-display";
import { resolveIssuerFacilityGate } from "./facility-enabled";

const scheduleOffer = {
  offered_amount: 100_000,
  platform_fee_rate_percent: 3,
  fee_schedule_version: 1,
  facility_fee_collect_amount: 800,
  additional_fees: [
    { name: "Legal fee", kind: "amount", value: 500 },
    { name: "Arrangement", kind: "percent_of_funded", value: 1 },
  ],
};

const grandfatherOffer = {
  offered_amount: 100_000,
  platform_fee_rate_percent: 3,
};

describe("buildInvoiceFeeDisplay", () => {
  it("uses the frozen schedule for estimates when fee_schedule_version is present", () => {
    const display = buildInvoiceFeeDisplay({
      status: "OFFER_SENT",
      offerDetails: scheduleOffer,
      isContractFinancing: true,
      contractFacilityFeeRatePercent: 1,
      contractFacilityFeeCapAmount: 2_000,
      contractFacilityFeePaidAmount: 0,
    });

    expect(display.mode).toBe("schedule");
    expect(display.phase).toBe("estimated");
    expect(display.platformFeeAmount).toBe(3_000);
    expect(display.platformFeeRatePercent).toBe(3);
    expect(display.facilityFeeAmount).toBe(800);
    expect(display.facilityFeeCollectAmount).toBe(800);
    expect(display.additionalFeeCharges).toEqual([
      { name: "Legal fee", kind: "amount", value: 500, chargedAmount: 500 },
      { name: "Arrangement", kind: "percent_of_funded", value: 1, chargedAmount: 1_000 },
    ]);
    expect(display.netDisbursementAmount).toBe(94_700);
    expect(display.estimatedFromOfferedAmount).toBe(true);
  });

  it("keeps percent extra lines tied to funded amount and fixed RM lines unchanged", () => {
    const display = buildInvoiceFeeDisplay({
      status: "ACTIVE",
      offerDetails: scheduleOffer,
      isContractFinancing: true,
      contractFacilityFeeCapAmount: 2_000,
      contractFacilityFeePaidAmount: 0,
      actual: { grossFundedAmount: 80_000 },
    });

    expect(display.mode).toBe("schedule");
    expect(display.platformFeeAmount).toBe(2_400);
    expect(display.facilityFeeAmount).toBe(800);
    expect(display.additionalFeeCharges.find((line) => line.name === "Legal fee")?.chargedAmount).toBe(
      500
    );
    expect(
      display.additionalFeeCharges.find((line) => line.name === "Arrangement")?.chargedAmount
    ).toBe(800);
    expect(display.estimatedFromOfferedAmount).toBe(false);
  });

  it("prefers withdrawal metadata after close", () => {
    const display = buildInvoiceFeeDisplay({
      status: "ACTIVE",
      offerDetails: scheduleOffer,
      isContractFinancing: true,
      actual: {
        grossFundedAmount: 80_000,
        platformFeeAmount: 2_400,
        facilityFeeCharged: 800,
        netIssuerDisbursement: 75_500,
        additionalFees: [
          { name: "Legal fee", kind: "amount", value: 500, chargedAmount: 500 },
          { name: "Arrangement", kind: "percent_of_funded", value: 1, chargedAmount: 800 },
        ],
      },
    });

    expect(display.phase).toBe("charged");
    expect(display.platformFeeAmount).toBe(2_400);
    expect(display.facilityFeeAmount).toBe(800);
    expect(display.netDisbursementAmount).toBe(75_500);
    expect(display.additionalFeeCharges.map((line) => line.chargedAmount)).toEqual([500, 800]);
  });

  it("shows a note-specific facility collection waiver", () => {
    const display = buildInvoiceFeeDisplay({
      status: "APPROVED",
      offerDetails: scheduleOffer,
      isContractFinancing: true,
      contractFacilityFeeCapAmount: 2_000,
      invoiceSnapshot: {
        fee_schedule_overrides: {
          version: 1,
          facility_fee_collection_waived: true,
          waived_reason: "Campaign goodwill",
        },
      },
    });

    expect(display.facilityFeeAmount).toBe(0);
    expect(display.facilityFeeCollectionWaived).toBe(true);
    expect(display.waiverReason).toBe("Campaign goodwill");
    expect(display.netDisbursementAmount).toBe(95_500);
  });

  it("grandfathers progressive facility-fee estimates when the schedule marker is absent", () => {
    const display = buildInvoiceFeeDisplay({
      status: "OFFER_SENT",
      offerDetails: grandfatherOffer,
      isContractFinancing: true,
      contractFacilityFeeRatePercent: 1,
      contractFacilityFeeCapAmount: 2_000,
      contractFacilityFeePaidAmount: 1_500,
    });

    expect(display.mode).toBe("grandfather");
    expect(display.platformFeeAmount).toBe(3_000);
    expect(display.facilityFeeAmount).toBe(500);
    expect(display.facilityFeeRatePercent).toBe(1);
    expect(display.additionalFeeCharges).toEqual([]);
    expect(display.netDisbursementAmount).toBe(96_500);
  });
});

describe("resolveIssuerFacilityGate", () => {
  it("treats a missing enabled key as enabled", () => {
    const gate = resolveIssuerFacilityGate({
      contractDetails: { approved_facility: 100_000 },
      contractStatus: "APPROVED",
    });
    expect(gate.enabled).toBe(true);
    expect(gate.canStartDrawdown).toBe(true);
  });

  it("blocks a new drawdown when the facility is disabled and surfaces the reason", () => {
    const gate = resolveIssuerFacilityGate({
      contractDetails: {
        facility_enabled: false,
        facility_disabled_reason: "Paused by CashSouk",
      },
      facilityEnabled: false,
      facilityDisabledReason: "Paused by CashSouk",
      contractStatus: "APPROVED",
    });
    expect(gate.enabled).toBe(false);
    expect(gate.canStartDrawdown).toBe(false);
    expect(gate.disabledReason).toBe("Paused by CashSouk");
  });
});
