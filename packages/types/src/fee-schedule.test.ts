import { NOTE_DEFAULT_MINIMUM_FUNDING_PERCENT } from "./note-money";
import {
  buildInvoiceFeeScheduleOfferPatch,
  computeScheduleFeesAtFundedAmount,
  feesExceedFundedAmount,
  hasInvoiceFeeSchedule,
  isExistingInvoiceOfferDetails,
  isGrandfatherInvoiceOfferDetails,
  offerFeesExceedFundingThresholds,
  resolveInvoiceFeeScheduleWriteMode,
  parseAdditionalFeeCharges,
  inspectInvoiceFeeSchedule,
  parseInvoiceFeeSchedule,
  settleDisbursementFees,
  validateAdditionalFeeLines,
  validateFacilityFeeCollectAmount,
  resolveFacilityFeeBalance,
  resolveFacilityFeeUpfront,
  isFacilityEnabled,
  computeFacilityFeeTotalOwed,
  isDisbursementNetNegative,
  isNoteOpenForFacilityFeeCollectionWaiver,
} from "./fee-schedule";

describe("invoice fee schedule", () => {
  const additionalAmount = { name: "Legal fee", kind: "amount" as const, value: 500 };
  const additionalPercent = { name: "Arrangement", kind: "percent_of_funded" as const, value: 1 };

  it("validates additional fee names, kinds, precision, uniqueness, and max lines", () => {
    expect(validateAdditionalFeeLines([{ name: "  Legal  ", kind: "amount", value: 10 }]).ok).toBe(
      true
    );
    expect(validateAdditionalFeeLines([{ name: "   ", kind: "amount", value: 10 }]).ok).toBe(false);
    expect(
      validateAdditionalFeeLines([
        { name: "Legal", kind: "amount", value: 10 },
        { name: "legal", kind: "amount", value: 5 },
      ]).ok
    ).toBe(false);
    expect(validateAdditionalFeeLines([{ name: "Legal", kind: "amount", value: -1 }]).ok).toBe(
      false
    );
    expect(validateAdditionalFeeLines([{ name: "Legal", kind: "amount", value: 10.001 }]).ok).toBe(
      false
    );
    expect(
      validateAdditionalFeeLines([{ name: "Pct", kind: "percent_of_funded", value: 100.01 }]).ok
    ).toBe(false);
    expect(
      validateAdditionalFeeLines(
        Array.from({ length: 11 }, (_, i) => ({
          name: `Fee ${i}`,
          kind: "amount" as const,
          value: 1,
        }))
      ).ok
    ).toBe(false);
  });

  it("accepts 0 facility collection and rejects negative / over-precise amounts", () => {
    expect(validateFacilityFeeCollectAmount(0).ok).toBe(true);
    expect(validateFacilityFeeCollectAmount(null).amount).toBe(0);
    expect(validateFacilityFeeCollectAmount(-1).ok).toBe(false);
    expect(validateFacilityFeeCollectAmount(1.001).ok).toBe(false);
  });

  it("detects the schedule marker even when collection and extra lines are zero", () => {
    expect(hasInvoiceFeeSchedule({ additional_fees: [], facility_fee_collect_amount: 0 })).toBe(
      false
    );
    expect(
      hasInvoiceFeeSchedule({
        fee_schedule_version: 1,
        facility_fee_collect_amount: 0,
        additional_fees: [],
      })
    ).toBe(true);
    expect(parseInvoiceFeeSchedule({ fee_schedule_version: 1 })?.facilityFeeCollectAmount).toBe(0);
    expect(inspectInvoiceFeeSchedule({ fee_schedule_version: 1 }).ok).toBe(true);
    expect(
      inspectInvoiceFeeSchedule({
        fee_schedule_version: 1,
        facility_fee_collect_amount: -10,
      })
    ).toMatchObject({ present: true, ok: false });
    expect(
      inspectInvoiceFeeSchedule({
        fee_schedule_version: 1,
        facility_fee_collect_amount: 0,
        additional_fees: [{ name: "Legal", kind: "not-a-kind", value: 10 }],
      }).ok
    ).toBe(false);
  });

  it("distinguishes a new offer from grandfather offer_details without a schedule version", () => {
    expect(isExistingInvoiceOfferDetails(null)).toBe(false);
    expect(isExistingInvoiceOfferDetails({})).toBe(false);
    expect(isGrandfatherInvoiceOfferDetails({ offered_amount: 40_000, sent_at: "2026-01-01" })).toBe(
      true
    );
    expect(
      isGrandfatherInvoiceOfferDetails({
        fee_schedule_version: 1,
        offered_amount: 40_000,
        sent_at: "2026-01-01",
      })
    ).toBe(false);
  });

  it("infers preserve for grandfather and v1 for new or already-versioned offers", () => {
    const grandfather = { offered_amount: 40_000, sent_at: "2026-01-01", version: 2 };
    expect(
      resolveInvoiceFeeScheduleWriteMode({ previousOfferDetails: grandfather })
    ).toEqual({ ok: true, mode: "preserve_grandfather" });
    expect(
      resolveInvoiceFeeScheduleWriteMode({
        requestedMode: "preserve_grandfather",
        previousOfferDetails: grandfather,
      })
    ).toEqual({ ok: true, mode: "preserve_grandfather" });
    expect(
      resolveInvoiceFeeScheduleWriteMode({
        requestedMode: "v1",
        previousOfferDetails: grandfather,
      })
    ).toEqual({ ok: true, mode: "v1" });
    expect(
      resolveInvoiceFeeScheduleWriteMode({ previousOfferDetails: null })
    ).toEqual({ ok: true, mode: "v1" });
    expect(
      resolveInvoiceFeeScheduleWriteMode({
        requestedMode: "v1",
        previousOfferDetails: { fee_schedule_version: 1 },
      })
    ).toEqual({ ok: true, mode: "v1" });
    expect(
      resolveInvoiceFeeScheduleWriteMode({
        requestedMode: "preserve_grandfather",
        previousOfferDetails: null,
      })
    ).toMatchObject({ ok: false, code: "FEE_SCHEDULE_MODE_INVALID" });
    expect(
      resolveInvoiceFeeScheduleWriteMode({
        requestedMode: "preserve_grandfather",
        previousOfferDetails: { fee_schedule_version: 1, offered_amount: 10_000 },
      })
    ).toMatchObject({ ok: false, code: "FEE_SCHEDULE_MODE_INVALID" });
  });

  it("computes 100% and 80% funded drawdown, fixed RM, and percent-of-funded lines", () => {
    const full = computeScheduleFeesAtFundedAmount({
      fundedAmount: 100_000,
      platformFeeRatePercent: 3,
      facilityFeeCollectAmount: 800,
      additionalFees: [additionalAmount, additionalPercent],
    });
    expect(full.drawdownFee).toBe(3000);
    expect(full.facilityFee).toBe(800);
    expect(full.additionalFeeCharges.map((line) => line.chargedAmount)).toEqual([500, 1000]);
    expect(full.totalFees).toBe(5300);
    expect(full.net).toBe(94_700);

    const partial = computeScheduleFeesAtFundedAmount({
      fundedAmount: 80_000,
      platformFeeRatePercent: 3,
      facilityFeeCollectAmount: 800,
      additionalFees: [additionalAmount, additionalPercent],
    });
    expect(partial.drawdownFee).toBe(2400);
    expect(partial.facilityFee).toBe(800);
    expect(partial.additionalFeeCharges.map((line) => line.chargedAmount)).toEqual([500, 800]);
    expect(partial.totalFees).toBe(4500);
    expect(partial.net).toBe(75_500);
  });

  it("blocks overflow at 100% and at the note default minimum funding percent", () => {
    expect(NOTE_DEFAULT_MINIMUM_FUNDING_PERCENT).toBe(80);
    const overflow = {
      offeredAmount: 10_000,
      platformFeeRatePercent: 3,
      facilityFeeCollectAmount: 8_000,
      additionalFees: [{ name: "Fixed", kind: "amount" as const, value: 2_000 }],
    };
    const result = offerFeesExceedFundingThresholds(overflow);
    expect(result.exceedsAtFull).toBe(true);
    expect(result.exceedsAtMinimum).toBe(true);
    expect(
      feesExceedFundedAmount({
        fundedAmount: 10_000,
        platformFeeRatePercent: 0,
        facilityFeeCollectAmount: 0,
        additionalFees: [{ name: "Fixed", kind: "amount" as const, value: 500 }],
      })
    ).toBe(false);
  });

  it("keeps RM additional fees fixed at partial funding while percent lines scale", () => {
    const patch = buildInvoiceFeeScheduleOfferPatch({
      facilityFeeCollectAmount: 100,
      additionalFees: [additionalAmount, additionalPercent],
    });
    expect(patch.fee_schedule_version).toBe(1);
    const parsed = parseInvoiceFeeSchedule(patch);
    expect(parsed?.additionalFees).toEqual([additionalAmount, additionalPercent]);
    const atMin = computeScheduleFeesAtFundedAmount({
      fundedAmount: 80_000,
      platformFeeRatePercent: 0,
      facilityFeeCollectAmount: 100,
      additionalFees: parsed?.additionalFees ?? [],
    });
    expect(atMin.additionalFeeCharges[0]?.chargedAmount).toBe(500);
    expect(atMin.additionalFeeCharges[1]?.chargedAmount).toBe(800);
  });

  it("zeroes a note's facility collection on per-note waiver and leaves remaining due", () => {
    const settled = settleDisbursementFees({
      fundedAmount: 100_000,
      platformFeeRatePercent: 2,
      offerDetails: {
        fee_schedule_version: 1,
        facility_fee_collect_amount: 1_000,
        additional_fees: [],
      },
      invoiceSnapshot: {
        fee_schedule_overrides: {
          version: 1,
          facility_fee_collection_waived: true,
          waived_reason: "campaign waiver",
        },
      },
      approvedFacilityAmount: 200_000,
      facilityFeeRatePercent: 1,
      facilityFeePaidBefore: 500,
      contractDetails: {
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_total_amount: 2_000,
        facility_fee_paid_amount: 500,
      },
    });
    expect(settled.mode).toBe("schedule");
    expect(settled.facilityFeeCharged).toBe(0);
    expect(settled.facilityFeeCollectionWaived).toBe(true);
    expect(settled.facilityFeeRemainingAfter).toBe(1_500);
    expect(settled.drawdownFee).toBe(2_000);
    expect(settled.netDisbursement).toBe(98_000);
  });

  it("applies a full remaining facility-fee waiver with no refund of amounts already charged", () => {
    const balance = resolveFacilityFeeBalance({
      approved_facility: 200_000,
      facility_fee_rate_percent: 1,
      facility_fee_total_amount: 2_000,
      facility_fee_paid_amount: 800,
      facility_fee_waived: true,
      facility_fee_waived_amount: 1_200,
    });
    expect(balance.paid).toBe(800);
    expect(balance.waived).toBe(true);
    expect(balance.waivedAmount).toBe(1_200);
    expect(balance.remaining).toBe(0);

    const settled = settleDisbursementFees({
      fundedAmount: 50_000,
      platformFeeRatePercent: 0,
      offerDetails: {
        fee_schedule_version: 1,
        facility_fee_collect_amount: 1_200,
        additional_fees: [],
      },
      approvedFacilityAmount: 200_000,
      facilityFeeRatePercent: 1,
      facilityFeePaidBefore: 800,
      contractDetails: {
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_total_amount: 2_000,
        facility_fee_paid_amount: 800,
        facility_fee_waived: true,
        facility_fee_waived_amount: 1_200,
      },
    });
    expect(settled.facilityFeeCharged).toBe(0);
    expect(settled.contractFacilityFeeWaived).toBe(true);
    expect(settled.facilityFeeRemainingAfter).toBe(0);
  });

  it("treats missing facility_enabled as enabled and reports disabled with a reason", () => {
    expect(isFacilityEnabled({})).toBe(true);
    expect(isFacilityEnabled({ facility_enabled: true })).toBe(true);
    expect(isFacilityEnabled({ facility_enabled: false, facility_disabled_reason: "Paused" })).toBe(
      false
    );
    expect(resolveFacilityFeeBalance({ facility_enabled: false }).enabled).toBe(false);
  });

  it("uses grandfathered funded×rate only when the schedule key is absent", () => {
    const grandfathered = settleDisbursementFees({
      fundedAmount: 100_000,
      platformFeeRatePercent: 3,
      offerDetails: { offered_amount: 100_000 },
      approvedFacilityAmount: 200_000,
      facilityFeeRatePercent: 1,
      facilityFeePaidBefore: 500,
      contractDetails: {
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_paid_amount: 500,
      },
    });
    expect(grandfathered.mode).toBe("grandfather");
    expect(grandfathered.drawdownFee).toBe(3_000);
    expect(grandfathered.facilityFeeCharged).toBe(1_000);
    expect(grandfathered.facilityFeeRemainingAfter).toBe(500);
    expect(grandfathered.additionalFeeCharges).toEqual([]);
    expect(grandfathered.netDisbursement).toBe(96_000);

    const zeroSchedule = settleDisbursementFees({
      fundedAmount: 100_000,
      platformFeeRatePercent: 3,
      offerDetails: {
        fee_schedule_version: 1,
        facility_fee_collect_amount: 0,
        additional_fees: [],
      },
      approvedFacilityAmount: 200_000,
      facilityFeeRatePercent: 1,
      facilityFeePaidBefore: 500,
      contractDetails: {
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_total_amount: 2_000,
        facility_fee_paid_amount: 500,
      },
    });
    expect(zeroSchedule.mode).toBe("schedule");
    expect(zeroSchedule.facilityFeeCharged).toBe(0);
    expect(zeroSchedule.facilityFeeRemainingAfter).toBe(1_500);
    expect(zeroSchedule.netDisbursement).toBe(97_000);
  });

  it("does not silently reduce a frozen schedule that exceeds actual funded", () => {
    const overflowed = settleDisbursementFees({
      fundedAmount: 10_000,
      platformFeeRatePercent: 0,
      offerDetails: {
        fee_schedule_version: 1,
        facility_fee_collect_amount: 8_000,
        additional_fees: [{ name: "Fixed", kind: "amount", value: 3_000 }],
      },
      approvedFacilityAmount: 1_000_000,
      facilityFeeRatePercent: 1,
      facilityFeePaidBefore: 0,
      contractDetails: {
        approved_facility: 1_000_000,
        facility_fee_rate_percent: 1,
        facility_fee_total_amount: 10_000,
        facility_fee_paid_amount: 0,
      },
    });
    expect(overflowed.mode).toBe("schedule");
    expect(overflowed.drawdownFee).toBe(0);
    expect(overflowed.facilityFeeCharged).toBe(8_000);
    expect(overflowed.additionalFeeCharges.map((line) => line.chargedAmount)).toEqual([3_000]);
    expect(overflowed.netDisbursement).toBe(-1_000);
    expect(isDisbursementNetNegative(overflowed.netDisbursement)).toBe(true);

    const atEightyPercent = settleDisbursementFees({
      fundedAmount: 80_000,
      platformFeeRatePercent: 3,
      offerDetails: {
        fee_schedule_version: 1,
        facility_fee_collect_amount: 800,
        additional_fees: [additionalAmount, additionalPercent],
      },
      approvedFacilityAmount: 200_000,
      facilityFeeRatePercent: 1,
      facilityFeePaidBefore: 0,
      contractDetails: {
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_total_amount: 2_000,
        facility_fee_paid_amount: 0,
      },
    });
    expect(atEightyPercent.mode).toBe("schedule");
    expect(atEightyPercent.drawdownFee).toBe(2_400);
    expect(atEightyPercent.facilityFeeCharged).toBe(800);
    expect(atEightyPercent.additionalFeeCharges.map((line) => line.chargedAmount)).toEqual([
      500, 800,
    ]);
    expect(atEightyPercent.netDisbursement).toBe(75_500);
    expect(isDisbursementNetNegative(atEightyPercent.netDisbursement)).toBe(false);
  });

  it("caps grandfathered progressive collection by remaining after outstanding v1 reservations", () => {
    const capped = settleDisbursementFees({
      fundedAmount: 50_000,
      platformFeeRatePercent: 0,
      offerDetails: { offered_amount: 50_000 },
      approvedFacilityAmount: 200_000,
      facilityFeeRatePercent: 1,
      facilityFeePaidBefore: 0,
      contractDetails: {
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_total_amount: 1_000,
        facility_fee_paid_amount: 0,
      },
      reservedFacilityFeeCollect: 800,
    });
    expect(capped.mode).toBe("grandfather");
    expect(capped.facilityFeeCharged).toBe(200);
    expect(capped.facilityFeeRemainingAfter).toBe(800);
    expect(capped.netDisbursement).toBe(49_800);

    const unreserved = settleDisbursementFees({
      fundedAmount: 50_000,
      platformFeeRatePercent: 0,
      offerDetails: { offered_amount: 50_000 },
      approvedFacilityAmount: 200_000,
      facilityFeeRatePercent: 1,
      facilityFeePaidBefore: 0,
      contractDetails: {
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_total_amount: 1_000,
        facility_fee_paid_amount: 0,
      },
    });
    expect(unreserved.facilityFeeCharged).toBe(500);
    expect(unreserved.facilityFeeRemainingAfter).toBe(500);
  });

  it("does not silently reduce an un-waived frozen schedule when remaining is short", () => {
    const overflowedRemaining = settleDisbursementFees({
      fundedAmount: 100_000,
      platformFeeRatePercent: 0,
      offerDetails: {
        fee_schedule_version: 1,
        facility_fee_collect_amount: 800,
        additional_fees: [],
      },
      approvedFacilityAmount: 200_000,
      facilityFeeRatePercent: 1,
      facilityFeePaidBefore: 500,
      contractDetails: {
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_total_amount: 1_000,
        facility_fee_paid_amount: 500,
      },
    });
    expect(overflowedRemaining.mode).toBe("schedule");
    expect(overflowedRemaining.facilityFeeCharged).toBe(800);
    expect(overflowedRemaining.facilityFeeRemainingAfter).toBe(0);
    expect(overflowedRemaining.netDisbursement).toBe(99_200);
  });

  it("still caps grandfathered charges to funded amount", () => {
    const grandfathered = settleDisbursementFees({
      fundedAmount: 10_000,
      platformFeeRatePercent: 90,
      offerDetails: { offered_amount: 10_000 },
      approvedFacilityAmount: 200_000,
      facilityFeeRatePercent: 1,
      facilityFeePaidBefore: 0,
      contractDetails: {
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_paid_amount: 0,
      },
    });
    expect(grandfathered.mode).toBe("grandfather");
    expect(grandfathered.drawdownFee).toBe(9_000);
    expect(grandfathered.facilityFeeCharged).toBe(100);
    expect(grandfathered.netDisbursement).toBe(900);
    expect(isDisbursementNetNegative(grandfathered.netDisbursement)).toBe(false);

    const overflowedGrandfather = settleDisbursementFees({
      fundedAmount: 10_000,
      platformFeeRatePercent: 100,
      offerDetails: { offered_amount: 10_000 },
      approvedFacilityAmount: 200_000,
      facilityFeeRatePercent: 1,
      facilityFeePaidBefore: 0,
      contractDetails: {
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_paid_amount: 0,
      },
    });
    expect(overflowedGrandfather.mode).toBe("grandfather");
    expect(overflowedGrandfather.drawdownFee).toBe(10_000);
    expect(overflowedGrandfather.facilityFeeCharged).toBe(0);
    expect(overflowedGrandfather.netDisbursement).toBe(0);
  });

  it("allows waiver only for draft/not-open and published/open notes", () => {
    expect(
      isNoteOpenForFacilityFeeCollectionWaiver({ status: "DRAFT", fundingStatus: "NOT_OPEN" })
    ).toBe(true);
    expect(
      isNoteOpenForFacilityFeeCollectionWaiver({ status: "PUBLISHED", fundingStatus: "OPEN" })
    ).toBe(true);
    expect(
      isNoteOpenForFacilityFeeCollectionWaiver({ status: "PUBLISHED", fundingStatus: "CLOSED" })
    ).toBe(false);
    expect(
      isNoteOpenForFacilityFeeCollectionWaiver({ status: "FUNDING", fundingStatus: "FUNDED" })
    ).toBe(false);
    expect(
      isNoteOpenForFacilityFeeCollectionWaiver({ status: "DRAFT", fundingStatus: "OPEN" })
    ).toBe(false);
  });

  it("resolves facility fee upfront by clamping to total owed and remaining paid", () => {
    expect(
      resolveFacilityFeeUpfront({
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_total_amount: 2_000,
        facility_fee_upfront_amount: 1_500,
        facility_fee_paid_amount: 400,
      })
    ).toEqual({ upfrontAmount: 1_500, outstanding: 1_100 });

    expect(
      resolveFacilityFeeUpfront({
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_total_amount: 2_000,
        facility_fee_upfront_amount: 5_000,
        facility_fee_paid_amount: 0,
      })
    ).toEqual({ upfrontAmount: 2_000, outstanding: 2_000 });

    expect(
      resolveFacilityFeeUpfront({
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_total_amount: 2_000,
        facility_fee_upfront_amount: -50,
        facility_fee_paid_amount: 0,
      })
    ).toEqual({ upfrontAmount: 0, outstanding: 0 });

    expect(
      resolveFacilityFeeUpfront({
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_total_amount: 2_000,
        facility_fee_upfront_amount: 1_000,
        facility_fee_paid_amount: 1_250,
      })
    ).toEqual({ upfrontAmount: 1_000, outstanding: 0 });

    expect(
      resolveFacilityFeeUpfront({
        approved_facility: 200_000,
        facility_fee_rate_percent: 1,
        facility_fee_total_amount: 2_000,
        facility_fee_upfront_amount: 1_500,
        facility_fee_paid_amount: 200,
        facility_fee_waived: true,
      })
    ).toEqual({ upfrontAmount: 1_500, outstanding: 0 });

    expect(resolveFacilityFeeUpfront({})).toEqual({ upfrontAmount: 0, outstanding: 0 });
  });

  it("stores 0% facility fee as a zero total owed", () => {
    expect(computeFacilityFeeTotalOwed(150_000, 0)).toBe(0);
    expect(computeFacilityFeeTotalOwed(150_000, 1)).toBe(1_500);
  });

  it("parses withdrawal additionalFee charges and skips invalid rows", () => {
    expect(parseAdditionalFeeCharges(undefined)).toBeUndefined();
    expect(parseAdditionalFeeCharges([])).toBeUndefined();
    expect(
      parseAdditionalFeeCharges([
        { name: "Legal fee", kind: "amount", value: 500, chargedAmount: 500 },
        { name: "Arrangement", kind: "percent_of_funded", value: "1", chargedAmount: "800.5" },
        { name: "", kind: "amount", value: 10, chargedAmount: 10 },
        { name: "Bad kind", kind: "other", value: 1, chargedAmount: 1 },
      ])
    ).toEqual([
      { name: "Legal fee", kind: "amount", value: 500, chargedAmount: 500 },
      { name: "Arrangement", kind: "percent_of_funded", value: 1, chargedAmount: 800.5 },
    ]);
  });
});
