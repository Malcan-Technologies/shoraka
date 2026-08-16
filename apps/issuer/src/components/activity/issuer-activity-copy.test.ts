import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "issuer-activity-list.tsx"), "utf8");

describe("issuer Activity presentation", () => {
  it("renders API activity copy and does not hardcode stale event labels", () => {
    expect(source).toContain("<ActivityItem");
    expect(source).not.toContain("Application Started");
    expect(source).not.toContain("now under review");
    expect(source).not.toContain("Application Closed");
    expect(source).not.toContain("Offer Signed");
    expect(source).not.toContain("Signing Package Voided");
    expect(source).not.toContain("reasonCode");
  });
});
