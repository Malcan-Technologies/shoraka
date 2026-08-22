import * as fs from "fs";
import * as path from "path";

describe("issuer invoice details capacity copy", () => {
  const source = fs.readFileSync(path.join(__dirname, "invoice-details-step.tsx"), "utf8");

  it("uses draft saveable warnings and reserved hard errors on the dual-limit preview", () => {
    expect(source).toContain('dualLimitOverageCopy(dualLimitPreview, "draft")');
    expect(source).toContain('dualLimitOverageCopy(dualLimitPreview, "reserved")');
    expect(source).toContain("ExistingFacilityLimitPreview");
    expect(source).toContain("warning={draftOverageCopy}");
    expect(source).toContain("hardError={capacityServerError ?? reservedOverageCopy}");
    expect(source).toContain("mapCapacityApiError");
  });
});
