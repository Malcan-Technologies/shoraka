import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROSPECTUS_FIXED_SHARIAH_PRINCIPLE } from "@cashsouk/types";
import { buildProspectusPaymentBasisShariah } from "./prospectus-payment-basis-shariah";
import { buildProspectusShariahHighlight } from "./prospectus-shariah-highlight";
import { SAMPLE_PROSPECTUS_SHARIAH_HIGHLIGHT_INPUT } from "./prospectus-shariah-highlight.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_SHARIAH_HIGHLIGHT_AUDIT,
  PROSPECTUS_SHARIAH_HIGHLIGHT_FIELD_SOURCES,
} from "./prospectus-shariah-highlight.types";
import { buildProspectusShariahHighlightDocument } from "./render-prospectus-shariah-highlight";

describe("prospectus Shariah Investor Highlight (Page 1 DATA STAGE 5D)", () => {
  it("documents unresolved status and Stage 4C principle reuse", () => {
    expect(
      PROSPECTUS_SHARIAH_HIGHLIGHT_FIELD_SOURCES.shariahCompliantStatus.canonicalSource
    ).toBe("none confirmed");
    expect(
      PROSPECTUS_SHARIAH_HIGHLIGHT_FIELD_SOURCES.specificShariahPrinciple.canonicalSource
    ).toContain("Stage 4C");
    expect(PROSPECTUS_SHARIAH_HIGHLIGHT_FIELD_SOURCES.evidenceSource.notes).toMatch(
      /usedAsEvidence = false/
    );
  });

  it("returns — for Shariah-compliant status", () => {
    const data = buildProspectusShariahHighlight({});
    expect(data.shariahCompliantStatus).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("reuses Stage 4C fixed principle without a separate resolver", () => {
    const stage4c = buildProspectusPaymentBasisShariah(SAMPLE_PROSPECTUS_SHARIAH_HIGHLIGHT_INPUT);
    const data = buildProspectusShariahHighlight(SAMPLE_PROSPECTUS_SHARIAH_HIGHLIGHT_INPUT);
    expect(data.specificShariahPrinciple).toBe(stage4c.shariahPrinciple);
    expect(data.specificShariahPrinciple).toBe(PROSPECTUS_FIXED_SHARIAH_PRINCIPLE);
    expect(data.audit.shariahPrinciple.reusedFromStage4C).toBe(true);

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-shariah-highlight.ts"),
      "utf8"
    );
    expect(moduleSource).toContain("buildProspectusPaymentBasisShariah");
    expect(moduleSource).toContain("stage4c.shariahPrinciple");
    expect(moduleSource).not.toContain("inferPrinciple");
    expect(moduleSource).not.toContain("mapPrinciple");
    expect(moduleSource).not.toContain("isShariahCompliant");
  });

  it("does not use Tawarruq, Shoraka, commodity, or murabaha as evidence", () => {
    const data = buildProspectusShariahHighlight({
      tawarruqStatus: "COMPLETED",
      shorakaStatus: "STP_COMPLETED",
      commodityType: "PALM_OIL",
      murabahaAmount: 500_000,
    });
    expect(data.shariahCompliantStatus).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.specificShariahPrinciple).toBe(PROSPECTUS_FIXED_SHARIAH_PRINCIPLE);
    expect(data.evidenceSource).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.tawarruq.usedAsEvidence).toBe(false);
    expect(data.audit.tawarruq.legalInterpretationAllowed).toBe(false);
  });

  it("does not use marketing Shariah Compliant wording as status", () => {
    const data = buildProspectusShariahHighlight({
      marketingShariahCompliantLabel: "Shariah Compliant",
    });
    expect(data.shariahCompliantStatus).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.shariahCompliantStatus).not.toBe("Shariah Compliant");
  });

  it("keeps adviser/approval, title, and explanation unavailable", () => {
    const data = buildProspectusShariahHighlight(SAMPLE_PROSPECTUS_SHARIAH_HIGHLIGHT_INPUT);
    expect(data.approvalOrAdviserReference).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightTitle).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.highlightExplanation).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.adviserApproval.adviserReferenceAvailable).toBe(false);
    expect(data.audit.highlight.claimApprovalRequired).toBe(true);
  });

  it("records live/frozen audit metadata and shows fixed principle in Canva HTML", () => {
    const data = buildProspectusShariahHighlight(SAMPLE_PROSPECTUS_SHARIAH_HIGHLIGHT_INPUT);
    expect(data.audit).toEqual(PROSPECTUS_SHARIAH_HIGHLIGHT_AUDIT);
    expect(data.audit.snapshot.isFrozen).toBe(false);
    expect(data.audit.snapshot.snapshotDecision).toBe("pending");

    const html = buildProspectusShariahHighlightDocument(data);
    expect(html).toContain("Shariah-Compliant Status: —");
    expect(html).toContain("Shariah Principle: Bai&#39; Al-Dayn Bi Al-Sila&#39;");
    expect(html).toContain(PROSPECTUS_FIXED_SHARIAH_PRINCIPLE.replace(/'/g, "&#39;"));
    expect(html).toContain("Evidence Source: —");
    expect(html).toContain("Adviser or Approval Reference: —");
    expect(html).toContain("Highlight Title: —");
    expect(html).toContain("Highlight Explanation: —");
    expect(html).not.toContain("Shariah-compliant investment");
    expect(html).not.toContain("transparent underlying transaction");
    expect(html).not.toContain("approved Shariah structure");
    expect(html).not.toContain("Tawarruq");
    expect(html).not.toContain("Shoraka");
    expect(html).not.toContain("commodity_type");
    expect(html).not.toContain("murabaha_amount");
    expect(html).not.toContain("Shariah Compliant");
    expect(html).not.toContain("sourceStatus");
    expect(html).not.toContain("inferenceAllowed");
    expect(html).not.toContain("productLevelStatusAvailable");
    expect(html).not.toContain("noteLevelStatusAvailable");
    expect(html).not.toContain("usedAsEvidence");
    expect(html).not.toContain("legalInterpretationAllowed");
    expect(html).not.toContain("adviserReferenceAvailable");
    expect(html).not.toContain("claimApprovalRequired");
    expect(html).not.toContain("snapshotDecision");
    expect(html).not.toContain("Frozen on Note");
    expect(html).not.toContain("Claim approval");
  });
});
