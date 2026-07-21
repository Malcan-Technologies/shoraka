import fs from "node:fs";
import path from "node:path";

const fieldPresentation = fs.readFileSync(
  path.join(__dirname, "field-presentation.tsx"),
  "utf8"
);
const sharedTable = fs.readFileSync(
  path.join(__dirname, "shared-financial-working-table.tsx"),
  "utf8"
);
const pageTwo = fs.readFileSync(path.join(__dirname, "working-area-page-two.tsx"), "utf8");
const pageThreeCoverage = fs.readFileSync(
  path.join(__dirname, "page-three-coverage.ts"),
  "utf8"
);

describe("prospectus field presentation — hidden sources", () => {
  it("does not render visible source body text under read-only cards", () => {
    expect(fieldPresentation).not.toContain("SOURCE_CLASS");
    expect(fieldPresentation).not.toMatch(/\{source \? <div/);
    expect(fieldPresentation).toContain("title={source}");
  });

  it("does not show reused source as visible table metric text", () => {
    expect(sharedTable).not.toMatch(/spec\.mode === "reused"[\s\S]{0,120}\(\{spec\.source\}\)/);
    expect(sharedTable).toContain('title={spec.mode === "reused" ? spec.source : undefined}');
  });

  it("hides Scale Version from Page 2 Risk Information while keeping grade/level/explanation", () => {
    expect(pageTwo).not.toContain("Scale Version");
    expect(pageTwo).not.toContain("soukscore-scale.v1");
    expect(pageTwo).toContain('label="Risk Grade"');
    expect(pageTwo).toContain('label="Risk Level"');
    expect(pageTwo).toContain('label="Explanation"');
    expect(pageTwo).toContain("risk.grade");
    expect(pageTwo).toContain("risk.label");
    expect(pageTwo).toContain("risk.explanation");
  });

  it("keeps Page 3 admin overview as separate Industry and Company Size fields", () => {
    expect(pageThreeCoverage).toContain('label: "Industry"');
    expect(pageThreeCoverage).toContain('label: "Company Size"');
    expect(pageThreeCoverage).toContain('label: "Risk Grade"');
    expect(pageThreeCoverage).toContain('label: "Paymaster Grading"');
    expect(pageThreeCoverage).toContain('label: "Confidence Grading"');
  });
});
