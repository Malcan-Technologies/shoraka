import { buildProspectusIssuerFundamentalsHighlight } from "./prospectus-issuer-fundamentals-highlight";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_ISSUER_FINANCIAL_DATA_SOURCE,
  PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_FIELD_SOURCES,
} from "./prospectus-issuer-fundamentals-highlight.types";
import { buildProspectusIssuerFundamentalsHighlightDocument } from "./render-prospectus-issuer-fundamentals-highlight";

describe("prospectus Issuer Financial-Strength Highlight (Page 1 DATA STAGE 5B)", () => {
  it("documents live Application FS source and unresolved claim fields", () => {
    expect(
      PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_FIELD_SOURCES.financialDataSource.canonicalSource
    ).toContain("applications.financial_statements");
    expect(
      PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_FIELD_SOURCES.profitabilityEvidence.availability
    ).toBe("unresolved");
    expect(PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_FIELD_SOURCES.highlightTitle.availability).toBe(
      "unresolved"
    );
    expect(PROSPECTUS_ISSUER_FUNDAMENTALS_HIGHLIGHT_FIELD_SOURCES.dataFrozenOnNote.notes).toContain(
      "not on the Note"
    );
  });

  it("lists year keys when provided; never invents strong/healthy claims", () => {
    const data = buildProspectusIssuerFundamentalsHighlight({
      financialYearsAvailable: ["2025", "2026"],
    });
    expect(data.financialDataSource).toBe(PROSPECTUS_ISSUER_FINANCIAL_DATA_SOURCE);
    expect(data.financialYearsAvailable).toBe("2025, 2026");
    expect(data.profitabilityEvidence).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.leverageEvidence).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightTitle).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.claimApprovalStatus).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.dataFrozenOnNote).toBe("No");
    expect(data.highlightTitle).not.toMatch(/strong/i);
    expect(data.highlightExplanation).not.toMatch(/healthy|conservative|consistent/i);
  });

  it("returns Data not available when year keys are missing", () => {
    const missing = buildProspectusIssuerFundamentalsHighlight({
      financialYearsAvailable: null,
    });
    expect(missing.financialYearsAvailable).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("renders plain HTML with Stage 5B lines", () => {
    const html = buildProspectusIssuerFundamentalsHighlightDocument();
    expect(html).toContain("Financial years available: 2025, 2026");
    expect(html).toContain("Data frozen on Note: No");
    expect(html).toContain("Highlight title: Data not available");
    expect(html).toContain("unaudited_by_year");
    expect(html).not.toContain("Strong issuer fundamentals");
  });
});
