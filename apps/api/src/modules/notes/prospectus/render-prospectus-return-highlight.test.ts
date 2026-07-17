import { buildProspectusTenureAndMaturity } from "./prospectus-dates-paymaster";
import { formatProspectusProfitRatePa } from "./prospectus-main-financial-terms";
import { buildProspectusReturnHighlight } from "./prospectus-return-highlight";
import { SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT } from "./prospectus-return-highlight.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES,
} from "./prospectus-return-highlight.types";
import { buildProspectusReturnHighlightDocument } from "./render-prospectus-return-highlight";

describe("prospectus Return Investor Highlight (Page 1 DATA STAGE 5C)", () => {
  it("documents gross rate, Stage 2 tenure, and unresolved marketing claims", () => {
    expect(PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES.annualGrossProfitRate.notes).toMatch(
      /GROSS/i
    );
    expect(PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES.tenure.canonicalSource).toContain(
      "buildProspectusTenureAndMaturity"
    );
    expect(PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES.returnClassification.availability).toBe(
      "unresolved"
    );
    expect(PROSPECTUS_RETURN_HIGHLIGHT_FIELD_SOURCES.tenureClassification.availability).toBe(
      "unresolved"
    );
  });

  it("reuses Stage 2 tenure and Stage 4A gross rate format; computes annual net", () => {
    const data = buildProspectusReturnHighlight(SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT);
    const tenure = buildProspectusTenureAndMaturity({
      listingOpensAt: SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT.listingOpensAt,
      maturityDate: SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT.maturityDate,
    });

    expect(data.annualGrossProfitRate).toBe(
      formatProspectusProfitRatePa(SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT.profitRatePercent)
    );
    expect(data.annualGrossProfitRate).toBe("12% p.a.");
    expect(data.tenure).toBe(tenure.tenure);
    expect(data.tenure).toBe("120 days");
    expect(data.netOrAfterFeeRate).toBe("10.2% p.a.");
    expect(data.returnClassification).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.tenureClassification).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightTitle).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightTitle).not.toMatch(/attractive|short-term/i);
    expect(data.highlightExplanation).not.toMatch(/after fees|earn up to/i);
  });

  it("returns Data not available for net rate when service fee is missing", () => {
    const missing = buildProspectusReturnHighlight({
      ...SAMPLE_PROSPECTUS_RETURN_HIGHLIGHT_INPUT,
      serviceFeeRatePercent: null,
    });
    expect(missing.netOrAfterFeeRate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("renders plain HTML with Stage 5C lines", () => {
    const html = buildProspectusReturnHighlightDocument();
    expect(html).toContain("Annual gross profit rate: 12% p.a.");
    expect(html).toContain("Tenure: 120 days");
    expect(html).toContain("Net or after-fee rate: 10.2% p.a.");
    expect(html).toContain("Highlight title: Data not available");
    expect(html).not.toContain("Attractive short-term returns");
  });
});
