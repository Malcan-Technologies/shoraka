import { buildProspectusPaymentBasisShariah } from "./prospectus-payment-basis-shariah";
import { buildProspectusShariahHighlight } from "./prospectus-shariah-highlight";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_SHARIAH_HIGHLIGHT_FIELD_SOURCES,
} from "./prospectus-shariah-highlight.types";
import { buildProspectusShariahHighlightDocument } from "./render-prospectus-shariah-highlight";

describe("prospectus Shariah Investor Highlight (Page 1 DATA STAGE 5D)", () => {
  it("documents unresolved compliance status distinct from Stage 4C principle", () => {
    expect(
      PROSPECTUS_SHARIAH_HIGHLIGHT_FIELD_SOURCES.shariahCompliantStatus.canonicalSource
    ).toBe("none confirmed");
    expect(
      PROSPECTUS_SHARIAH_HIGHLIGHT_FIELD_SOURCES.specificShariahPrinciple.canonicalSource
    ).toContain("Stage 4C");
    expect(PROSPECTUS_SHARIAH_HIGHLIGHT_FIELD_SOURCES.evidenceSource.notes).toMatch(/Tawarruq/i);
    expect(PROSPECTUS_SHARIAH_HIGHLIGHT_FIELD_SOURCES.frozenOnNote.availability).toBe("constant");
  });

  it("returns Data not available for claims; reuses Stage 4C principle DNA; frozen No", () => {
    const data = buildProspectusShariahHighlight({});
    const stage4c = buildProspectusPaymentBasisShariah({});

    expect(data.shariahCompliantStatus).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.specificShariahPrinciple).toBe(stage4c.shariahPrinciple);
    expect(data.evidenceSource).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.approvalOrAdviserReference).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightTitle).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.claimApprovalStatus).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.frozenOnNote).toBe("No");
    expect(data.highlightTitle).not.toMatch(/Shariah-compliant investment/i);
    expect(data.highlightExplanation).not.toMatch(/transparent underlying|Shariah principles/i);
  });

  it("renders plain HTML with Stage 5D lines", () => {
    const html = buildProspectusShariahHighlightDocument();
    expect(html).toContain("Shariah-compliant status: Data not available");
    expect(html).toContain("Specific Shariah principle: Data not available");
    expect(html).toContain("Frozen on Note: No");
    expect(html).toContain("Tawarruq is not used as prospectus evidence");
    expect(html).not.toContain("Shariah-compliant investment</");
    expect(html).not.toContain("Structured in accordance");
  });
});
