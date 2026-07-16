import { SAMPLE_PROSPECTUS_STAGE1_TERMS } from "./prospectus.sample-data";
import {
  buildProspectusStage1FieldRows,
  buildProspectusStage1Html,
} from "./prospectus-stage1.html";
import { PROSPECTUS_STAGE1_FIELD_SOURCES } from "./prospectus.types";
import { buildProspectusStage1Document } from "./render-prospectus-stage1";

describe("prospectus Stage 1 terms preview", () => {
  it("exposes a source catalog entry for every Stage 1 field", () => {
    const keys = Object.keys(SAMPLE_PROSPECTUS_STAGE1_TERMS);
    expect(keys).toHaveLength(13);
    for (const key of keys) {
      expect(PROSPECTUS_STAGE1_FIELD_SOURCES[key as keyof typeof SAMPLE_PROSPECTUS_STAGE1_TERMS]).toBeDefined();
    }
  });

  it("builds field rows with values and source paths", () => {
    const rows = buildProspectusStage1FieldRows(SAMPLE_PROSPECTUS_STAGE1_TERMS);
    expect(rows).toHaveLength(13);
    expect(rows.find((r) => r.key === "noteReference")?.value).toBe(
      SAMPLE_PROSPECTUS_STAGE1_TERMS.noteReference
    );
    expect(rows.find((r) => r.key === "purposeOfFinancing")?.source.availability).toBe("missing");
    expect(rows.find((r) => r.key === "shariahPrinciple")?.source.availability).toBe("unresolved");
    expect(rows.find((r) => r.key === "expectedReturn")?.source.availability).toBe("calculated");
  });

  it("renders plain HTML with all Stage 1 labels and sample values", () => {
    const html = buildProspectusStage1Document();

    expect(html).toContain("Prospectus Page 1 — Stage 1 data preview");
    expect(html).toContain(SAMPLE_PROSPECTUS_STAGE1_TERMS.noteReference);
    expect(html).toContain(SAMPLE_PROSPECTUS_STAGE1_TERMS.financingType);
    expect(html).toContain(SAMPLE_PROSPECTUS_STAGE1_TERMS.listingDate);
    expect(html).toContain(SAMPLE_PROSPECTUS_STAGE1_TERMS.maturityDate);
    expect(html).toContain(SAMPLE_PROSPECTUS_STAGE1_TERMS.paymaster);
    expect(html).toContain(SAMPLE_PROSPECTUS_STAGE1_TERMS.financingAmount);
    expect(html).toContain(SAMPLE_PROSPECTUS_STAGE1_TERMS.minimumInvestment);
    expect(html).toContain(SAMPLE_PROSPECTUS_STAGE1_TERMS.profitRate);
    expect(html).toContain("Expected return");
    expect(html).toContain("Tenure");
    expect(html).toContain("Purpose of financing");
    expect(html).toContain("Payment basis");
    expect(html).toContain("Shariah principle");
    expect(html).toContain("note_reference");
    expect(html).toContain("target_amount");
    expect(buildProspectusStage1Html(SAMPLE_PROSPECTUS_STAGE1_TERMS)).toContain("<table");
  });
});
