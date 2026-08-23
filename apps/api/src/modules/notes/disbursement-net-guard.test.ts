import { AppError } from "../../lib/http/error-handler";
import {
  isDisbursementNetNegative,
  settleDisbursementFees,
} from "@cashsouk/types";
import { rejectNegativeDisbursementNet } from "./disbursement-net-guard";

const overflowScheduleInput = {
  fundedAmount: 10_000,
  platformFeeRatePercent: 0,
  offerDetails: {
    fee_schedule_version: 1,
    facility_fee_collect_amount: 8_000,
    additional_fees: [{ name: "Fixed", kind: "amount" as const, value: 3_000 }],
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
};

const scheduleAtEightyPercentInput = {
  fundedAmount: 80_000,
  platformFeeRatePercent: 3,
  offerDetails: {
    fee_schedule_version: 1,
    facility_fee_collect_amount: 800,
    additional_fees: [
      { name: "Legal fee", kind: "amount" as const, value: 500 },
      { name: "Arrangement", kind: "percent_of_funded" as const, value: 1 },
    ],
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
};

describe("closeFunding negative-net guard", () => {
  it("rejects an overflowing frozen schedule without reducing charges", () => {
    const settled = settleDisbursementFees(overflowScheduleInput);
    expect(settled.mode).toBe("schedule");
    expect(settled.facilityFeeCharged).toBe(8_000);
    expect(settled.additionalFeeCharges.map((line) => line.chargedAmount)).toEqual([3_000]);
    expect(settled.netDisbursement).toBe(-1_000);
    expect(isDisbursementNetNegative(settled.netDisbursement)).toBe(true);
    expect(() => rejectNegativeDisbursementNet(settled.netDisbursement)).toThrow(AppError);
    try {
      rejectNegativeDisbursementNet(settled.netDisbursement);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("DISBURSEMENT_NET_NEGATIVE");
      expect((error as AppError).statusCode).toBe(409);
    }
  });

  it("keeps an 80% funded schedule exact and allows close", () => {
    const settled = settleDisbursementFees(scheduleAtEightyPercentInput);
    expect(settled.mode).toBe("schedule");
    expect(settled.drawdownFee).toBe(2_400);
    expect(settled.facilityFeeCharged).toBe(800);
    expect(settled.additionalFeeCharges.map((line) => line.chargedAmount)).toEqual([500, 800]);
    expect(settled.netDisbursement).toBe(75_500);
    expect(isDisbursementNetNegative(settled.netDisbursement)).toBe(false);
    expect(() => rejectNegativeDisbursementNet(settled.netDisbursement)).not.toThrow();
  });
});
