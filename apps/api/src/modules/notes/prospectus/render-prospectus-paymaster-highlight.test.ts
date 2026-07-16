import { SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT } from "./prospectus-dates-paymaster.sample-data";
import { buildProspectusPaymasterHighlight } from "./prospectus-paymaster-highlight";
import { SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT_INPUT } from "./prospectus-paymaster-highlight.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAYMASTER_HIGHLIGHT_FIELD_SOURCES,
} from "./prospectus-paymaster-highlight.types";
import { buildProspectusPaymasterHighlightDocument } from "./render-prospectus-paymaster-highlight";

describe("prospectus Paymaster Investor Highlight (Page 1 DATA STAGE 5A)", () => {
  it("documents frozen snapshot sources and unresolved claim fields", () => {
    expect(PROSPECTUS_PAYMASTER_HIGHLIGHT_FIELD_SOURCES.paymasterName.canonicalSource).toBe(
      "notes.paymaster_snapshot.name"
    );
    expect(PROSPECTUS_PAYMASTER_HIGHLIGHT_FIELD_SOURCES.paymasterEntityType.canonicalSource).toBe(
      "notes.paymaster_snapshot.entity_type"
    );
    expect(
      PROSPECTUS_PAYMASTER_HIGHLIGHT_FIELD_SOURCES.governmentClassification.availability
    ).toBe("unresolved");
    expect(PROSPECTUS_PAYMASTER_HIGHLIGHT_FIELD_SOURCES.highlightTitle.availability).toBe(
      "unresolved"
    );
  });

  it("reuses Stage 2 paymaster name and entity type; does not invent claims", () => {
    const data = buildProspectusPaymasterHighlight(SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT_INPUT);
    expect(data.paymasterName).toBe(SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.paymasterName);
    expect(data.paymasterEntityType).toBe(
      SAMPLE_PROSPECTUS_DATES_PAYMASTER_INPUT.paymasterEntityType
    );
    expect(data.governmentClassification).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.paymasterPaymentTrackRecord).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightTitle).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.claimApprovalStatus).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightTitle).not.toContain("strong government");
    expect(data.highlightExplanation).not.toMatch(/track record/i);
  });

  it("returns Data not available when paymaster snapshot fields are empty", () => {
    const missing = buildProspectusPaymasterHighlight({
      paymasterName: "  ",
      paymasterEntityType: null,
    });
    expect(missing.paymasterName).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missing.paymasterEntityType).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("renders plain HTML with Stage 5A lines", () => {
    const html = buildProspectusPaymasterHighlightDocument();
    expect(html).toContain("Paymaster name: Kementerian Kerja Raya (KKR)");
    expect(html).toContain("Paymaster entity type: Federal Government Agency");
    expect(html).toContain("Government classification: Data not available");
    expect(html).toContain("Highlight title: Data not available");
    expect(html).not.toContain("Backed by a strong government paymaster");
  });
});
