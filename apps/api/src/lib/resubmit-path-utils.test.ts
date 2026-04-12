import { buildResubmitChangedPathSet, resubmitPathIsChanged } from "@cashsouk/types";

describe("resubmitPathIsChanged", () => {
  it("matches exact path", () => {
    const s = buildResubmitChangedPathSet([{ path: "business_details.about.foo" }]);
    expect(resubmitPathIsChanged("business_details.about.foo", s)).toBe(true);
  });

  it("matches parent when child changed", () => {
    const s = buildResubmitChangedPathSet([{ path: "business_details.about.foo" }]);
    expect(resubmitPathIsChanged("business_details", s)).toBe(true);
  });

  it("matches child when prefix path recorded", () => {
    const s = buildResubmitChangedPathSet([{ path: "business_details" }]);
    expect(resubmitPathIsChanged("business_details.about.foo", s)).toBe(true);
  });

  it("returns false for unrelated paths", () => {
    const s = buildResubmitChangedPathSet([{ path: "company_details.x" }]);
    expect(resubmitPathIsChanged("business_details", s)).toBe(false);
  });
});
