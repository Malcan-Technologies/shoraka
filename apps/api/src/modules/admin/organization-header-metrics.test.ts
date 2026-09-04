import fs from "node:fs";
import path from "node:path";
import { sumApprovedFacilityAmount } from "./organization-header-metrics";

describe("sumApprovedFacilityAmount", () => {
  it("sums approved_facility on APPROVED contracts and in-force amended lines", () => {
    const total = sumApprovedFacilityAmount([
      { status: "APPROVED", contract_details: { approved_facility: 100000 } },
      { status: "APPROVED", contract_details: { approved_facility: "25000" } },
      { status: "SUBMITTED", contract_details: { approved_facility: 50000 } },
      { status: "AMENDMENT_REQUESTED", contract_details: { approved_facility: 10000 } },
      { status: "APPROVED", contract_details: { approved_facility: 0 } },
    ]);
    expect(total).toBe(135000);
  });

  it("returns 0 when there are no approved facilities", () => {
    expect(sumApprovedFacilityAmount([])).toBe(0);
    expect(
      sumApprovedFacilityAmount([{ status: "DRAFT", contract_details: { approved_facility: 10 } }])
    ).toBe(0);
  });

  it("filters standalone holders before loading issuer header facilities", () => {
    const serviceSource = fs.readFileSync(path.join(__dirname, "service.ts"), "utf8");

    expect(serviceSource).toContain("AND: [realFacilityContractWhere()]");
  });
});
