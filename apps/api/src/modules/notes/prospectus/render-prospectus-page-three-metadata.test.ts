import { readFileSync } from "node:fs";
import { join } from "node:path";
import { financialSourceFromYearBlocks } from "./prospectus-financial-comparison-test-helpers";
import { SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE } from "./prospectus-financial-comparison-source.sample-data";
import { buildProspectusPageThreeMetadata } from "./prospectus-page-three-metadata";
import { SAMPLE_PROSPECTUS_PAGE_THREE_METADATA_INPUT } from "./prospectus-page-three-metadata.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAGE_THREE_METADATA_AUDIT,
  PROSPECTUS_PAGE_THREE_METADATA_FIELD_SOURCES,
  PROSPECTUS_PAGE_THREE_METADATA_LABELS,
  PROSPECTUS_PAGE_THREE_PAGE_TITLE,
} from "./prospectus-page-three-metadata.types";
import { buildProspectusPageThreeMetadataDocument } from "./render-prospectus-page-three-metadata";

const VALID_GRADES = ["A", "B", "C", "D", "E", "F"] as const;

function withSource(
  overrides: Partial<typeof SAMPLE_PROSPECTUS_PAGE_THREE_METADATA_INPUT> = {}
) {
  return buildProspectusPageThreeMetadata({
    ...SAMPLE_PROSPECTUS_PAGE_THREE_METADATA_INPUT,
    ...overrides,
    financialSource:
      overrides.financialSource ?? SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE,
  });
}

describe("prospectus Page 3 metadata (DATA STAGE 1)", () => {
  it("uses static page title DETAILED FINANCIAL COMPARISON", () => {
    const data = withSource();
    expect(data.pageTitle).toBe("DETAILED FINANCIAL COMPARISON");
    expect(data.pageTitle).toBe(PROSPECTUS_PAGE_THREE_PAGE_TITLE);
  });

  it("uses approved static Page 3 subtitle", () => {
    expect(withSource().pageSubtitle).toBe(
      "Additional financial view for investors seeking deeper issuer analysis"
    );
    expect(withSource().pageSubtitle).not.toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("hides issuer identity from metadata strip", () => {
    expect(withSource().metadata).not.toHaveProperty("issuer");
    expect(withSource({ issuerName: "ABC Engineering Sdn Bhd" }).metadata).not.toHaveProperty(
      "issuer"
    );
    expect(PROSPECTUS_PAGE_THREE_METADATA_AUDIT.issuerIdentity.companyNameHidden).toBe(true);
  });

  it("maps Sector as Industry | Company Size from Page 2 anonymous sources", () => {
    expect(withSource().metadata.sector).toBe("Construction | Medium");
  });

  it("maps missing Industry and Company Size to —", () => {
    expect(
      withSource({ issuerSector: undefined, officerCompanySize: undefined }).metadata
        .sector
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("shows Industry | — when Company Size is missing", () => {
    expect(
      withSource({ issuerSector: "Construction", officerCompanySize: undefined }).metadata
        .sector
    ).toBe("Construction | —");
  });

  it("shows — | Size when Industry is missing", () => {
    expect(
      withSource({ issuerSector: undefined, officerCompanySize: "Small" }).metadata.sector
    ).toBe("— | Small");
  });

  it("rejects invalid Company Size for Sector (no SME label)", () => {
    expect(
      withSource({ issuerSector: "Construction", officerCompanySize: "SME" }).metadata
        .sector
    ).toBe("Construction | —");
  });

  it.each(VALID_GRADES)("accepts valid risk rating %s", (grade) => {
    expect(withSource({ selectedRiskRating: grade }).metadata.riskRating).toBe(grade);
  });

  it("rejects invalid C risk rating", () => {
    expect(withSource({ selectedRiskRating: "C" }).metadata.riskRating).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
  });

  it("rejects invalid A- risk rating", () => {
    expect(withSource({ selectedRiskRating: "A-" }).metadata.riskRating).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
  });

  it("maps missing risk rating to —", () => {
    expect(withSource({ selectedRiskRating: undefined }).metadata.riskRating).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
  });

  it("maps paymaster from frozen paymaster name input", () => {
    expect(withSource().metadata.paymaster).toBe("Kementerian Kerja Raya");
  });

  it("maps missing paymaster to —", () => {
    expect(withSource({ paymasterName: undefined }).metadata.paymaster).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
  });

  it("maps missing Page 2 Paymaster Grading to —", () => {
    expect(
      withSource({ officerPaymasterRating: undefined }).metadata.paymasterGrading
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("maps missing Page 2 Confidence Grading to —", () => {
    expect(
      withSource({ officerConfidenceGrading: undefined }).metadata.confidenceGrading
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("reuses Page 2 Paymaster Rating via shared catalogue (PM1–PM4)", () => {
    expect(withSource({ officerPaymasterRating: "PM3" }).metadata.paymasterGrading).toBe(
      "PM3"
    );
    expect(withSource({ officerPaymasterRating: "PM9" }).metadata.paymasterGrading).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
  });

  it("reuses Page 2 Confidence Grading via shared catalogue (High|Medium|Low)", () => {
    expect(withSource({ officerConfidenceGrading: "Low" }).metadata.confidenceGrading).toBe(
      "Low"
    );
    expect(
      withSource({ officerConfidenceGrading: "Very High" }).metadata.confidenceGrading
    ).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("does not invent gradings without officer Page 2 input", () => {
    const data = withSource({
      officerPaymasterRating: null,
      officerConfidenceGrading: null,
    });
    expect(data.metadata.paymasterGrading).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.metadata.confidenceGrading).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("omits Issuer entirely from the metadata view-model and HTML", () => {
    const data = withSource({
      issuerName: "ABC Engineering Sdn Bhd",
    });
    expect(data.metadata).not.toHaveProperty("issuer");
    expect(Object.keys(data.metadata)).toEqual([
      "sector",
      "riskRating",
      "paymaster",
      "paymasterGrading",
      "confidenceGrading",
    ]);
    const html = buildProspectusPageThreeMetadataDocument(data);
    expect(html).not.toMatch(/\bIssuer\b/);
    expect(html).not.toContain("ABC Engineering");
    expect(html).not.toContain("202001234567");
    expect(html).not.toContain("SSM");
    expect(html).not.toContain("registration");
    expect(html).toContain("Sector");
    expect(html).toContain("Construction | Medium");
    expect(html).toContain("Paymaster");
    expect(html).toContain("Kementerian Kerja Raya");
    for (const label of Object.values(PROSPECTUS_PAGE_THREE_METADATA_LABELS)) {
      expect(html).toContain(label);
    }
  });

  it("does not map Canva A–E grades", () => {
    expect(PROSPECTUS_PAGE_THREE_METADATA_AUDIT.riskRating.canvaAtoEMappingAllowed).toBe(
      false
    );
    for (const grade of ["C", "D", "E", "A-", "AA+"]) {
      expect(withSource({ selectedRiskRating: grade }).metadata.riskRating).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );
    }
  });

  it("reuses the existing Page 2 financial source years array", () => {
    const source = SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE;
    const data = withSource({ financialSource: source });
    expect(data.financialYears).toBe(source.years);
    expect(data.audit.financialSource.reusedFrom).toBe(
      "page_2_financial_comparison_source"
    );
  });

  it("does not independently select years in the Page 3 module", () => {
    const moduleSource = readFileSync(
      join(__dirname, "prospectus-page-three-metadata.ts"),
      "utf8"
    );
    expect(moduleSource).not.toMatch(/selectProspectusFinancialComparisonYears/);
    expect(moduleSource).not.toMatch(/unaudited_by_year/);
    expect(moduleSource).not.toMatch(/buildProspectusFinancialComparisonSource/);
    expect(moduleSource).not.toMatch(/formatProspectusFinancialYearEndLabel/);
    expect(dataAuditIndependentSelection()).toBe(false);
  });

  it("keeps selected years in Page 2 order", () => {
    const source = SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE;
    const data = withSource({ financialSource: source });
    expect(data.financialYears.map((y) => y.year)).toEqual(
      source.years.map((y) => y.year)
    );
    expect(data.financialYears.map((y) => y.year)).toEqual([2022, 2023, 2024]);
  });

  it("supports fewer than three years via the reused source", () => {
    const source = financialSourceFromYearBlocks({
      "2024": { turnover: 100 },
    });
    const data = withSource({ financialSource: source });
    expect(data.financialYears).toHaveLength(1);
    expect(data.financialYears[0]?.year).toBe(2024);
    expect(data.financialYears[0]?.yearLabel).toBe("FY2024");
  });

  it("does not fabricate missing years", () => {
    const source = financialSourceFromYearBlocks({
      "2023": { turnover: 1 },
      "2024": { turnover: 2 },
    });
    const data = withSource({ financialSource: source });
    expect(data.financialYears.map((y) => y.year)).toEqual([2023, 2024]);
    expect(data.financialYears.some((y) => y.year === 2022)).toBe(false);
  });

  it("does not use CTOS fallback for years or metadata", () => {
    const source = SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE;
    const data = withSource({
      financialSource: source,
      ctosFinancials: {
        financials: [{ financial_year: 2020, turnover: 9_999_999 }],
      },
      liveOrganizationName: "LIVE ORG",
      livePaymasterName: "LIVE PAYMASTER",
    });
    expect(data.audit.financialSource.ctosFallbackAllowed).toBe(false);
    expect(data.financialYears.some((y) => y.year === 2020)).toBe(false);
    expect(data.metadata).not.toHaveProperty("issuer");
    expect(JSON.stringify(data.metadata)).not.toContain("LIVE ORG");
    expect(data.metadata.paymaster).not.toBe("LIVE PAYMASTER");
  });

  it("does not label or display bsclbank as Cash & Bank", () => {
    const builder = readFileSync(
      join(__dirname, "prospectus-page-three-metadata.ts"),
      "utf8"
    );
    const htmlModule = readFileSync(
      join(__dirname, "prospectus-page-three-metadata.html.ts"),
      "utf8"
    );
    const types = readFileSync(
      join(__dirname, "prospectus-page-three-metadata.types.ts"),
      "utf8"
    );
    expect(builder).not.toMatch(/Cash\s*&\s*Bank/i);
    expect(htmlModule).not.toMatch(/Cash\s*&\s*Bank/i);
    expect(types).toMatch(/Non-Current Assets/);
    const html = buildProspectusPageThreeMetadataDocument(withSource());
    expect(html).not.toMatch(/Cash\s*&\s*Bank/i);
  });

  it("exposes exact visible metadata fields without issuer", () => {
    const data = withSource();
    expect(Object.keys(data.metadata).sort()).toEqual(
      [
        "confidenceGrading",
        "paymaster",
        "paymasterGrading",
        "riskRating",
        "sector",
      ].sort()
    );
    expect(PROSPECTUS_PAGE_THREE_METADATA_LABELS).toEqual({
      sector: "Sector",
      riskRating: "Risk Rating",
      paymaster: "Paymaster",
      paymasterGrading: "Paymaster Grading",
      confidenceGrading: "Confidence Grading",
    });
    expect(PROSPECTUS_PAGE_THREE_METADATA_LABELS).not.toHaveProperty("issuer");
  });

  it("does not expose raw IDs in Canva-facing fields or HTML", () => {
    const data = withSource({
      issuerName: "ABC Engineering Sdn Bhd",
    });
    const visible = [
      data.pageTitle,
      data.pageSubtitle,
      ...Object.values(data.metadata),
      ...data.financialYears.map((y) => `${y.yearLabel} ${y.financialYearEndLabel}`),
    ].join(" ");
    expect(visible).not.toMatch(/note_/i);
    expect(visible).not.toMatch(/application_/i);
    expect(visible).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-/i);

    const html = buildProspectusPageThreeMetadataDocument(data);
    expect(html).not.toContain("notes.issuer_snapshot");
    expect(html).not.toContain("unaudited_by_year");
  });

  it("hides audit metadata from HTML", () => {
    const html = buildProspectusPageThreeMetadataDocument(withSource());
    expect(html).not.toContain("page_2_financial_comparison_source");
    expect(html).not.toContain("isSoukscoreRiskRating");
    expect(html).not.toContain("liveFallbackAllowed");
    expect(html).not.toContain("extensionPending");
    expect(html).not.toContain("approvedStaticCopyAvailable");
    expect(PROSPECTUS_PAGE_THREE_METADATA_FIELD_SOURCES.pageSubtitle.availability).toBe(
      "static"
    );
  });

  it("preserves FYE labels from the reused Page 2 source", () => {
    const source = SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_SOURCE;
    const data = withSource({ financialSource: source });
    expect(data.financialYears.map((y) => y.financialYearEndLabel)).toEqual(
      source.years.map((y) => y.financialYearEndLabel)
    );
  });

  it("documents shared snapshot extension plan without separate Page 3 freeze", () => {
    expect(PROSPECTUS_PAGE_THREE_METADATA_AUDIT.snapshot).toEqual({
      sharedFinancialFreeze: "page_2.financial_comparison",
      separatePageThreeFinancialSnapshotRecommended: false,
      extensionPending: true,
    });
  });
});

function dataAuditIndependentSelection(): boolean {
  return PROSPECTUS_PAGE_THREE_METADATA_AUDIT.financialSource
    .independentYearSelectionAllowed;
}
