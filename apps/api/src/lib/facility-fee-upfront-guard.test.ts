import { AppError } from "./http/error-handler";
import {
  assertFacilityFeeUpfrontSettled,
  facilityFeeUpfrontDto,
  overlayFacilityFeeUpfrontDto,
} from "./facility-fee-upfront-guard";

function expectAppError(run: () => unknown, code: string, statusCode: number) {
  try {
    run();
    throw new Error(`expected ${code} to be thrown`);
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    expect((error as AppError).statusCode).toBe(statusCode);
  }
}

const unpaidUpfront = {
  facility_fee_total_amount: 1_500,
  facility_fee_upfront_amount: 400,
  facility_fee_paid_amount: 100,
};

describe("assertFacilityFeeUpfrontSettled", () => {
  it("returns when outstanding is zero because nothing is due", () => {
    expect(() =>
      assertFacilityFeeUpfrontSettled({
        facility_fee_total_amount: 1_500,
        facility_fee_upfront_amount: 0,
        facility_fee_paid_amount: 0,
      })
    ).not.toThrow();
  });

  it("returns when paid covers the upfront amount", () => {
    expect(() =>
      assertFacilityFeeUpfrontSettled({
        facility_fee_total_amount: 1_500,
        facility_fee_upfront_amount: 400,
        facility_fee_paid_amount: 400,
      })
    ).not.toThrow();
  });

  it("returns when remaining facility fee is waived", () => {
    expect(() =>
      assertFacilityFeeUpfrontSettled({
        ...unpaidUpfront,
        facility_fee_waived: true,
      })
    ).not.toThrow();
  });

  it("throws 409 FACILITY_FEE_UPFRONT_REQUIRED with safe amounts when unpaid", () => {
    expectAppError(
      () => assertFacilityFeeUpfrontSettled(unpaidUpfront),
      "FACILITY_FEE_UPFRONT_REQUIRED",
      409
    );
    try {
      assertFacilityFeeUpfrontSettled(unpaidUpfront);
    } catch (error) {
      expect((error as AppError).details).toEqual({
        outstanding: 300,
        upfrontAmount: 400,
        paidAmount: 100,
      });
    }
  });
});

describe("facilityFeeUpfrontDto", () => {
  it("reuses resolveFacilityFeeUpfront amounts without extra math", () => {
    expect(facilityFeeUpfrontDto(unpaidUpfront)).toEqual({
      facilityFeeUpfrontAmount: 400,
      facilityFeeUpfrontOutstanding: 300,
    });
    expect(overlayFacilityFeeUpfrontDto({ id: "con-1", contract_details: unpaidUpfront })).toEqual({
      id: "con-1",
      contract_details: unpaidUpfront,
      facilityFeeUpfrontAmount: 400,
      facilityFeeUpfrontOutstanding: 300,
    });
  });
});
