import { resolveFacilityFeeUpfrontRail } from "./facility-fee-upfront-rail";

describe("resolveFacilityFeeUpfrontRail", () => {
  it("omits the rail when no upfront amount is requested", () => {
    expect(
      resolveFacilityFeeUpfrontRail({
        offerDetails: { facility_fee_upfront_collect_amount: 0 },
        contractDetails: { facility_fee_total_amount: 1_000 },
      })
    ).toBeNull();
  });

  it("reads the offer collect amount before the facility is accepted", () => {
    expect(
      resolveFacilityFeeUpfrontRail({
        offerDetails: { facility_fee_upfront_collect_amount: 400 },
      })
    ).toEqual({
      requested: 400,
      outstanding: 400,
      paidTowardUpfront: 0,
      waived: false,
    });
  });

  it("uses the stamped contract amount and paid balance after accept", () => {
    expect(
      resolveFacilityFeeUpfrontRail({
        offerDetails: { facility_fee_upfront_collect_amount: 400 },
        contractDetails: {
          approved_facility: 100_000,
          facility_fee_rate_percent: 1,
          facility_fee_total_amount: 1_000,
          facility_fee_upfront_amount: 400,
          facility_fee_paid_amount: 150,
        },
      })
    ).toEqual({
      requested: 400,
      outstanding: 250,
      paidTowardUpfront: 150,
      waived: false,
    });
  });

  it("treats a waiver as settled", () => {
    expect(
      resolveFacilityFeeUpfrontRail({
        contractDetails: {
          approved_facility: 100_000,
          facility_fee_total_amount: 1_000,
          facility_fee_upfront_amount: 400,
          facility_fee_paid_amount: 0,
          facility_fee_waived: true,
        },
      })
    ).toMatchObject({
      requested: 400,
      outstanding: 0,
      waived: true,
    });
  });
});
