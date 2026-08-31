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
    // Tooltip-only: reused source stays on title (with placeholder branch), not cell body text.
    expect(sharedTable).toMatch(
      /title=\{\s*header\.isPlaceholder[\s\S]*spec\.mode === "reused"[\s\S]*spec\.source/
    );
  });

  it("shows full Risk Rating Scale on Page 2 Risk Information without Scale Version", () => {
    expect(pageTwo).not.toContain("Scale Version");
    expect(pageTwo).not.toContain("soukscore-scale.v1");
    expect(pageTwo).toContain("data-prospectus-risk-rating-scale");
    expect(pageTwo).toContain("MARC_SME_BANDS");
    expect(pageTwo).toContain("Risk Rating Scale");
    expect(pageTwo).not.toContain("Full A–F Cashsouk scale for reference.");
    expect(pageTwo).toContain("Risk Level");
    expect(pageTwo).toContain("Description");
    expect(pageTwo).toContain("CASHSCOUK_RISK_GRADE_LETTER_COLOR");
  });

  it("keeps Page 3 admin overview as separate Industry and Company Size fields", () => {
    expect(pageThreeCoverage).toContain('label: "Industry"');
    expect(pageThreeCoverage).toContain('label: "Company Size"');
    expect(pageThreeCoverage).toContain('label: "Risk Grade"');
    expect(pageThreeCoverage).toContain('label: "Paymaster"');
    expect(pageThreeCoverage).not.toContain('label: "Paymaster Grading"');
    expect(pageThreeCoverage).not.toContain('label: "Confidence Grading"');
  });
});
