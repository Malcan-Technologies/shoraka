import { sumApprovedFacilityAmount } from "./organization-header-metrics";

describe("sumApprovedFacilityAmount", () => {
  it("sums approved_facility on APPROVED contracts only", () => {
    const total = sumApprovedFacilityAmount([
      { status: "APPROVED", contract_details: { approved_facility: 100000 } },
      { status: "APPROVED", contract_details: { approved_facility: "25000" } },
      { status: "SUBMITTED", contract_details: { approved_facility: 50000 } },
      { status: "APPROVED", contract_details: { approved_facility: 0 } },
    ]);
    expect(total).toBe(125000);
  });

  it("returns 0 when there are no approved facilities", () => {
    expect(sumApprovedFacilityAmount([])).toBe(0);
    expect(
      sumApprovedFacilityAmount([{ status: "DRAFT", contract_details: { approved_facility: 10 } }])
    ).toBe(0);
  });
});
