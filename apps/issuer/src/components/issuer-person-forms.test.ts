import { readFileSync } from "fs";
import { join } from "path";

describe("issuer person forms", () => {
  const source = readFileSync(join(__dirname, "issuer-person-forms.tsx"), "utf8");

  it("validates the 5% shareholder floor on add and edit", () => {
    expect(source).toContain("issuerShareholdingThresholdIssue");
  });

  it("lets issuer edit shareholding percentage even when a value already exists", () => {
    expect(source).not.toContain("party.isShareholder && !party.shareholdingPercentage");
    expect(source).toContain("{party.isShareholder ? (");
  });
});
