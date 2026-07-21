import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildProspectusDatesPaymaster } from "./prospectus-dates-paymaster";
import { buildProspectusPaymasterHighlight } from "./prospectus-paymaster-highlight";
import { SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT_INPUT } from "./prospectus-paymaster-highlight.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAYMASTER_HIGHLIGHT_AUDIT,
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

  it("preserves exact trimmed paymaster name", () => {
    const data = buildProspectusPaymasterHighlight({
      paymasterName: "  Kementerian Kerja Raya  ",
      paymasterEntityType: "Federal Government Agency",
    });
    expect(data.paymasterName).toBe("Kementerian Kerja Raya");
  });

  it("returns — when paymaster name is missing", () => {
    const missing = buildProspectusPaymasterHighlight({
      paymasterName: "  ",
      paymasterEntityType: "Federal Government Agency",
    });
    expect(missing.paymasterName).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("preserves exact entity type without shortening", () => {
    const data = buildProspectusPaymasterHighlight({
      paymasterName: "Kementerian Kerja Raya",
      paymasterEntityType: "Federal Government Agency",
    });
    expect(data.paymasterEntityType).toBe("Federal Government Agency");
    expect(data.paymasterEntityType).not.toBe("Government Agency");
  });

  it("returns — when entity type is missing", () => {
    const missing = buildProspectusPaymasterHighlight({
      paymasterName: "Kementerian Kerja Raya",
      paymasterEntityType: null,
    });
    expect(missing.paymasterEntityType).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("does not infer government classification from entity type", () => {
    const data = buildProspectusPaymasterHighlight({
      paymasterName: "Kementerian Kerja Raya",
      paymasterEntityType: "Federal Government Agency",
    });
    expect(data.governmentClassification).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.governmentClassification.inferenceAllowed).toBe(false);
  });

  it("does not invent paymaster track record from Note repayment observations", () => {
    const data = buildProspectusPaymasterHighlight(SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT_INPUT);
    expect(data.paymasterPaymentTrackRecord).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.paymentTrackRecord.historicalDataAvailable).toBe(false);
  });

  it("keeps highlight title and explanation unavailable", () => {
    const data = buildProspectusPaymasterHighlight(SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT_INPUT);
    expect(data.highlightTitle).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.highlightTitle.claimApprovalRequired).toBe(true);
    expect(data.audit.highlightExplanation.claimApprovalRequired).toBe(true);
  });

  it("reuses Stage 2 paymaster formatting and does not add a second resolver", () => {
    const stage2 = buildProspectusDatesPaymaster({
      listingOpensAt: null,
      maturityDate: null,
      paymasterName: SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT_INPUT.paymasterName,
      paymasterEntityType: SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT_INPUT.paymasterEntityType,
    });
    const stage5a = buildProspectusPaymasterHighlight(
      SAMPLE_PROSPECTUS_PAYMASTER_HIGHLIGHT_INPUT
    );
    expect(stage5a.paymasterName).toBe(stage2.paymasterName);
    expect(stage5a.paymasterEntityType).toBe(stage2.paymasterEntityType);
    expect(stage5a.audit).toEqual(PROSPECTUS_PAYMASTER_HIGHLIGHT_AUDIT);

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-paymaster-highlight.ts"),
      "utf8"
    );
    expect(moduleSource).toContain("buildProspectusDatesPaymaster");
    expect(moduleSource).not.toContain("paymaster_snapshot");
    expect(moduleSource).not.toContain("isGovernment");
  });

  it("renders Canva-facing HTML without marketing claims or audit keys", () => {
    const html = buildProspectusPaymasterHighlightDocument();
    expect(html).toContain("Paymaster Name: Kementerian Kerja Raya");
    expect(html).toContain("Paymaster Entity Type: Federal Government Agency");
    expect(html).toContain("Government Classification: —");
    expect(html).toContain("Paymaster Payment Track Record: —");
    expect(html).toContain("Highlight Title: —");
    expect(html).toContain("Highlight Explanation: —");
    expect(html).not.toContain("Backed by a strong government paymaster");
    expect(html).not.toMatch(/strong payment track record/i);
    expect(html).not.toMatch(/reliable payer/i);
    expect(html).not.toMatch(/government-backed/i);
    expect(html).not.toMatch(/low-risk paymaster/i);
    expect(html).not.toContain("claimApprovalStatus");
    expect(html).not.toContain("sourceStatus");
    expect(html).not.toContain("inferenceAllowed");
    expect(html).not.toContain("historicalDataAvailable");
    expect(html).not.toContain("isFrozen");
    expect(html).not.toContain("Claim approval");
  });
});
