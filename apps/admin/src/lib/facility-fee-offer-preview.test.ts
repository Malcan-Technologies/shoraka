import {
  buildSendContractOfferPayload,
  parseFacilityFeeRatePercentInput,
  parseFacilityFeeUpfrontInput,
  resolveFacilityFeeOfferSplit,
  resolveUpfrontCollectAmountForSubmit,
  seedFacilityFeeUpfrontInput,
  validateFacilityFeeUpfrontCollectAmount,
  FACILITY_FEE_UPFRONT_REQUIRED_MESSAGE,
} from "./facility-fee-offer-preview";

describe("facility fee offer preview", () => {
  it("computes total, upfront, and remaining for drawdown collections at 2dp", () => {
    expect(
      resolveFacilityFeeOfferSplit({
        offeredFacility: 150_000,
        facilityFeeRatePercent: 1,
        upfrontCollectAmount: 400,
      })
    ).toEqual({
      totalFacilityFee: 1_500,
      upfrontAmount: 400,
      remainingForDrawdown: 1_100,
    });

    expect(
      resolveFacilityFeeOfferSplit({
        offeredFacility: 100_000.125,
        facilityFeeRatePercent: 0.25,
        upfrontCollectAmount: 50.129,
      })
    ).toEqual({
      totalFacilityFee: 250,
      upfrontAmount: 50.13,
      remainingForDrawdown: 199.87,
    });
  });

  it("treats a missing rate or RM0 upfront as no gateway collection", () => {
    expect(
      resolveFacilityFeeOfferSplit({
        offeredFacility: 200_000,
        facilityFeeRatePercent: null,
        upfrontCollectAmount: 0,
      })
    ).toEqual({
      totalFacilityFee: 0,
      upfrontAmount: 0,
      remainingForDrawdown: 0,
    });
  });

  it("validates 0 <= upfront <= total without changing the typed value", () => {
    const rawInput = "2,000.00";
    expect(
      validateFacilityFeeUpfrontCollectAmount({
        rawInput,
        upfrontCollectAmount: 2_000,
        totalFacilityFee: 1_500,
      })
    ).toBe("Upfront amount cannot be more than the total facility fee");
    expect(parseFacilityFeeUpfrontInput(rawInput)).toBe(2_000);

    expect(
      validateFacilityFeeUpfrontCollectAmount({
        rawInput: "",
        upfrontCollectAmount: 0,
        totalFacilityFee: 1_500,
      })
    ).toBe(FACILITY_FEE_UPFRONT_REQUIRED_MESSAGE);
    expect(
      validateFacilityFeeUpfrontCollectAmount({
        rawInput: "0",
        upfrontCollectAmount: 0,
        totalFacilityFee: 1_500,
      })
    ).toBeNull();
    expect(
      validateFacilityFeeUpfrontCollectAmount({
        rawInput: "",
        upfrontCollectAmount: 0,
        totalFacilityFee: 0,
      })
    ).toBeNull();

    expect(
      validateFacilityFeeUpfrontCollectAmount({
        rawInput: "-1",
        upfrontCollectAmount: -1,
        totalFacilityFee: 1_500,
      })
    ).toBe("Upfront amount cannot be negative");

    expect(
      validateFacilityFeeUpfrontCollectAmount({
        rawInput: "1.001",
        upfrontCollectAmount: 1.001,
        totalFacilityFee: 1_500,
      })
    ).toBe("Upfront amount can have up to 2 decimal places");
  });

  it("seeds the snapshotted offer value including RM0", () => {
    expect(seedFacilityFeeUpfrontInput({ facility_fee_upfront_collect_amount: 400 })).toBe(
      "400.00"
    );
    expect(seedFacilityFeeUpfrontInput({ facility_fee_upfront_collect_amount: 0 })).toBe("0.00");
    expect(seedFacilityFeeUpfrontInput({})).toBe("");
    expect(seedFacilityFeeUpfrontInput(null)).toBe("");
  });

  it("builds the send-offer payload with the API field", () => {
    expect(
      buildSendContractOfferPayload({
        offeredFacility: 150_000,
        facilityFeeRatePercent: 1,
        upfrontCollectAmount: 400.1,
      })
    ).toEqual({
      offeredFacility: 150_000,
      facilityFeeRatePercent: 1,
      facilityFeeUpfrontCollectAmount: 400.1,
    });
    expect(parseFacilityFeeRatePercentInput("")).toBeNull();
    expect(parseFacilityFeeRatePercentInput("0.25")).toBe(0.25);
    expect(resolveUpfrontCollectAmountForSubmit("")).toBe(0);
    expect(resolveUpfrontCollectAmountForSubmit("1,250.50")).toBe(1_250.5);
  });

  it("rejects incomplete or malformed upfront money strings instead of coercing to 0", () => {
    expect(parseFacilityFeeUpfrontInput("")).toBe(0);
    expect(parseFacilityFeeUpfrontInput("-")).toBeNull();
    expect(parseFacilityFeeUpfrontInput(".")).toBeNull();
    expect(parseFacilityFeeUpfrontInput("1.")).toBeNull();
    expect(parseFacilityFeeUpfrontInput("abc")).toBeNull();
    expect(parseFacilityFeeUpfrontInput("1e2")).toBeNull();
    expect(resolveUpfrontCollectAmountForSubmit("")).toBe(0);
    expect(resolveUpfrontCollectAmountForSubmit("-")).toBeNull();
    expect(resolveUpfrontCollectAmountForSubmit(".")).toBeNull();
    expect(resolveUpfrontCollectAmountForSubmit("1.")).toBeNull();
    expect(resolveUpfrontCollectAmountForSubmit("abc")).toBeNull();
    expect(resolveUpfrontCollectAmountForSubmit("-1")).toBeNull();
    expect(
      validateFacilityFeeUpfrontCollectAmount({
        rawInput: "-",
        upfrontCollectAmount: parseFacilityFeeUpfrontInput("-"),
        totalFacilityFee: 1_500,
      })
    ).toBe("Upfront amount must be a valid number");
    expect(
      validateFacilityFeeUpfrontCollectAmount({
        rawInput: "",
        upfrontCollectAmount: parseFacilityFeeUpfrontInput(""),
        totalFacilityFee: 1_500,
      })
    ).toBe(FACILITY_FEE_UPFRONT_REQUIRED_MESSAGE);
  });
});
