import { readFileSync } from "fs";
import { join } from "path";

const panel = readFileSync(join(__dirname, "organization-profile-panel.tsx"), "utf8");

describe("Admin About the Business edit labels", () => {
  it("marks required completeness blockers as required in edit mode", () => {
    expect(panel).toContain('required={aboutActivitiesRequired}');
    expect(panel).toContain('required={aboutCustomersRequired}');
    expect(panel).not.toContain('label="Company Activities" optional');
    expect(panel).not.toContain('label="Who Are Your Main Customers?" optional');
  });
});

