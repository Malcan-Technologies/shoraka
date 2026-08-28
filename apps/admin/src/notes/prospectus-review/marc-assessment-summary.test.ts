import fs from "node:fs";
import path from "node:path";
import { isMarcSmeGrade } from "@cashsouk/types";

const source = fs.readFileSync(path.join(__dirname, "marc-assessment-summary.tsx"), "utf8");
const pageTwo = fs.readFileSync(path.join(__dirname, "working-area-page-two.tsx"), "utf8");
const hrefs = fs.readFileSync(
  path.join(__dirname, "../../lib/admin-directory-hrefs.ts"),
  "utf8"
);

describe("Prospectus MARC assessment summary", () => {
  it("treats only a live SME grade as a usable organization assessment", () => {
    expect(isMarcSmeGrade("SME-4")).toBe(true);
    expect(isMarcSmeGrade("A")).toBe(false);
    expect(isMarcSmeGrade(null)).toBe(false);
    expect(source).toContain("hasUsableMarcAssessment");
    expect(source).toContain("isCompleteIssuerMarcAssessment");
  });

  it("renders a read-only org MARC summary with a manage action, not officer inputs", () => {
    expect(source).toContain("MARC Credit Assessment");
    expect(source).toContain('label="Credit Grade"');
    expect(source).toContain('label="Credit Score"');
    expect(source).toContain('label="Probability of Default"');
    expect(source).toContain('label="Report"');
    expect(source).toContain('label="Last Updated"');
    expect(source).toContain("View Report");
    expect(source).toContain("Manage MARC Assessment");
    expect(source).toContain("issuerMarcHref");
    expect(source).toContain("ProspectusReadOnlyField");
    expect(source).toContain("MARC_ASSESSMENT_REQUIRED_MESSAGE");
    expect(source).not.toContain("ProspectusOptionSelect");
    expect(source).not.toContain("MARC Confidence Grading");
    expect(pageTwo).not.toContain("MARC Confidence Grading");
    expect(pageTwo).not.toContain("MARC Paymaster Grading");
    expect(hrefs).toContain("?tab=organization#marc-assessment");
  });
});
