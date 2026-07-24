import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildProspectusIssuerFundamentalsHighlight,
  normalizeProspectusFinancialYearsAvailable,
} from "./prospectus-issuer-fundamentals-highlight";
import { SAMPLE_PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_INPUT } from "./prospectus-issuer-fundamentals-highlight.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_ISSUER_FINANCIAL_DATA_SOURCE,
  PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_FIELD_SOURCES,
} from "./prospectus-issuer-fundamentals-highlight.types";
import { buildProspectusIssuerFundamentalsHighlightDocument } from "./render-prospectus-issuer-fundamentals-highlight";

describe("prospectus Issuer Fundamentals Highlight (Page 1 DATA STAGE 5B)", () => {
  it("documents unresolved claim fields and live Application FS source in audit", () => {
    expect(
      PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_FIELD_SOURCES.profitabilityEvidence.availability
    ).toBe("unresolved");
    expect(PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_FIELD_SOURCES.highlightTitle.availability).toBe(
      "unresolved"
    );
    expect(PROSPECTUS_ISSUER_FINANCIAL_DATA_SOURCE).toBe("applications.financial_statements");
  });

  it("records financial years in audit metadata only", () => {
    const data = buildProspectusIssuerFundamentalsHighlight({
      financialYearsAvailable: ["2025", "2026"],
    });
    expect(data.audit.financialYearsAvailable).toEqual(["2025", "2026"]);
    expect(data.audit.financialDataSource).toBe(PROSPECTUS_ISSUER_FINANCIAL_DATA_SOURCE);
    expect(normalizeProspectusFinancialYearsAvailable([" 2025 ", "", "2026"])).toEqual([
      "2025",
      "2026",
    ]);
  });

  it("does not invent claims when financial years are missing", () => {
    const missing = buildProspectusIssuerFundamentalsHighlight({
      financialYearsAvailable: null,
    });
    expect(missing.audit.financialYearsAvailable).toEqual([]);
    expect(missing.profitabilityEvidence).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.leverageEvidence).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.highlightTitle).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.highlightExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("does not classify profitability from positive PAT values", () => {
    const data = buildProspectusIssuerFundamentalsHighlight({
      financialYearsAvailable: ["2025"],
      yearMetricsObserved: [{ year: "2025", plnpat: 900_000, plnpbt: 1_100_000 }],
    });
    expect(data.profitabilityEvidence).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.profitabilityEvidence).not.toMatch(/profitable|strong|healthy/i);
  });

  it("does not claim consistent profitability from multiple positive years", () => {
    const data = buildProspectusIssuerFundamentalsHighlight(
      SAMPLE_PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_INPUT
    );
    expect(data.profitabilityEvidence).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.profitabilityEvidence).not.toMatch(/consistent profitability/i);
  });

  it("does not invent negative profitability narratives either", () => {
    const data = buildProspectusIssuerFundamentalsHighlight({
      financialYearsAvailable: ["2025"],
      yearMetricsObserved: [{ year: "2025", plnpat: -50_000 }],
    });
    expect(data.profitabilityEvidence).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.profitabilityEvidence).not.toMatch(/loss|weak|unprofitable/i);
  });

  it("does not classify leverage from low or high gearing observations", () => {
    const low = buildProspectusIssuerFundamentalsHighlight({
      financialYearsAvailable: ["2025"],
      yearMetricsObserved: [{ year: "2025", gearing: 0.2 }],
    });
    const high = buildProspectusIssuerFundamentalsHighlight({
      financialYearsAvailable: ["2025"],
      yearMetricsObserved: [{ year: "2025", gearing: 3.5 }],
    });
    expect(low.leverageEvidence).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(high.leverageEvidence).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(low.leverageEvidence).not.toMatch(/conservative|low gearing|healthy/i);
    expect(high.leverageEvidence).not.toMatch(/high|risky|overleveraged/i);
  });

  it("keeps highlight title and explanation unavailable", () => {
    const data = buildProspectusIssuerFundamentalsHighlight(
      SAMPLE_PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_INPUT
    );
    expect(data.highlightTitle).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("records live/frozen audit metadata and hides it from Canva HTML", () => {
    const data = buildProspectusIssuerFundamentalsHighlight(
      SAMPLE_PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_INPUT
    );
    expect(data.audit.sourceType).toBe("live_application");
    expect(data.audit.isFrozen).toBe(false);
    expect(data.audit.snapshotDecision).toBe("pending");
    expect(data.audit.claimApproval.status).toBe("pending");

    const html = buildProspectusIssuerFundamentalsHighlightDocument(data);
    expect(html).toContain("Profitability Evidence: —");
    expect(html).toContain("Leverage Evidence: —");
    expect(html).toContain("Highlight Title: —");
    expect(html).toContain("Highlight Explanation: —");
    expect(html).not.toContain("Strong issuer fundamentals");
    expect(html).not.toContain("Healthy financial profile");
    expect(html).not.toContain("Consistent profitability");
    expect(html).not.toContain("Conservative leverage");
    expect(html).not.toContain("financialDataSource");
    expect(html).not.toContain("financialYears");
    expect(html).not.toContain("sourceType");
    expect(html).not.toContain("isFrozen");
    expect(html).not.toContain("snapshotDecision");
    expect(html).not.toContain("claimApproval");
    expect(html).not.toContain("profit_margin");
    expect(html).not.toContain("gearing");
    expect(html).not.toContain("applications.financial_statements");
    expect(html).not.toContain("2025");
  });

  it("does not introduce Stage 5B threshold or classification helpers", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-issuer-fundamentals-highlight.ts"),
      "utf8"
    );
    expect(moduleSource).not.toMatch(/THRESHOLD|isProfitable|isConservative|classify/i);
    expect(moduleSource).not.toContain("from \"@cashsouk/types\"");
    expect(moduleSource).not.toContain("financial-calculator");
    expect(moduleSource).not.toMatch(/\bcalculateProfitMargin\s*\(/);
    expect(moduleSource).not.toMatch(/\bcalculateGearing\s*\(/);
  });
});
