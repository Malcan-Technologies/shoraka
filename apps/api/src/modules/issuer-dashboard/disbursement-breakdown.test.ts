import { mapIssuerDisbursementBreakdown } from "./disbursement-breakdown";

describe("mapIssuerDisbursementBreakdown", () => {
  it("maps charged extra fees and collection waiver from withdrawal metadata", () => {
    expect(
      mapIssuerDisbursementBreakdown({
        grossFundedAmount: 100_000,
        platformFeeAmount: 3_000,
        facilityFeeCharged: 0,
        netIssuerDisbursement: 96_200,
        additionalFees: [
          { name: "Legal fee", kind: "amount", value: 500, chargedAmount: 500 },
          { name: "Arrangement", kind: "percent_of_funded", value: 0.3, chargedAmount: 300 },
        ],
        facilityFeeCollectionWaived: true,
      })
    ).toEqual({
      grossFundedAmount: "100000.00",
      platformFeeAmount: "3000.00",
      facilityFeeCharged: "0.00",
      netIssuerDisbursement: "96200.00",
      additionalFees: [
        { name: "Legal fee", kind: "amount", value: 500, chargedAmount: 500 },
        { name: "Arrangement", kind: "percent_of_funded", value: 0.3, chargedAmount: 300 },
      ],
      facilityFeeCollectionWaived: true,
    });
  });

  it("omits extra fees and waiver when metadata predates the schedule fields", () => {
    expect(
      mapIssuerDisbursementBreakdown({
        grossFundedAmount: "50000",
        platformFeeAmount: "1500",
        facilityFeeCharged: "400",
        netIssuerDisbursement: "48100",
      })
    ).toEqual({
      grossFundedAmount: "50000.00",
      platformFeeAmount: "1500.00",
      facilityFeeCharged: "400.00",
      netIssuerDisbursement: "48100.00",
    });
  });

  it("treats false waiver and invalid extra-fee rows as absent", () => {
    expect(
      mapIssuerDisbursementBreakdown({
        facilityFeeCollectionWaived: false,
        additionalFees: [{ name: "", kind: "amount", value: 10, chargedAmount: 10 }],
      })
    ).toEqual({
      grossFundedAmount: null,
      platformFeeAmount: null,
      facilityFeeCharged: null,
      netIssuerDisbursement: null,
    });
  });
});
