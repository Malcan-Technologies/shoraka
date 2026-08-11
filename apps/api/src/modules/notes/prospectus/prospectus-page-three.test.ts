import { NoteStatus } from "@prisma/client";
import { buildProspectusFinancialComparisonMetrics } from "./prospectus-financial-comparison-metrics";
import { parseProspectusPageTwoSnapshot } from "./prospectus-json-guards";
import {
  buildProspectusPageThree,
  mapProspectusPageThreeDataToInput,
} from "./prospectus-page-three-mapper";
import {
  isProspectusNotePublished,
  PROSPECTUS_PAGE_THREE_NOTE_SELECT,
  type ProspectusPageThreeLoadedData,
  type ProspectusPageThreeNoteRecord,
} from "./prospectus-page-three-prisma";
import {
  SAMPLE_PROSPECTUS_PAGE_THREE,
  SAMPLE_PROSPECTUS_PAGE_THREE_INPUT,
} from "./prospectus-page-three.sample-data";
import { PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT } from "./prospectus-placeholder-publication-content";
import {
  PROSPECTUS_PAGE_THREE_HEIGHT_MM,
  PROSPECTUS_PAGE_THREE_VISIBLE_CONTENT_STAGES,
  PROSPECTUS_PAGE_THREE_WIDTH_MM,
} from "./prospectus-page-three.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import {
  buildProspectusPage2Snapshot,
  PROSPECTUS_PAGE_TWO_RAW_FINANCIAL_KEYS,
  wrapProspectusSnapshotWithPageTwo,
} from "./prospectus-page-two-snapshot";
import { renderProspectusPageThreeHtml } from "./render-prospectus-page-three";

function baseNote(
  overrides: Partial<ProspectusPageThreeNoteRecord> = {}
): ProspectusPageThreeNoteRecord {
  return {
    id: "clsamplepage3note0001",
    status: NoteStatus.DRAFT,
    published_at: null,
    source_application_id: "app-p3-1",
    issuer_organization_id: "org-p3-1",
    issuer_snapshot: {
      name: "ABC Engineering Sdn Bhd",
      industry: "Construction",
    },
    invoice_snapshot: {
      offer_details: { risk_rating: "B" },
    },
    paymaster_snapshot: {
      name: "Kementerian Kerja Raya",
    },
    prospectus_snapshot: null,
    ...overrides,
  };
}

const liveFinancialStatements = {
  questionnaire: { financial_year_end: "2027-12-31" },
  unaudited_by_year: {
    "2022": {
      turnover: 13_900_000,
      plnpbt: 1_400_000,
      plnpat: 1_200_000,
      bsqpuc: 2_000_000,
      networth: 2_000_000,
      bsfatot: 1_500_000,
      othass: 1_000_000,
      bscatot: 4_700_000,
      bsclbank: 900_000,
      curlib: 2_900_000,
      bsslltd: 500_000,
      bsclstd: 200_000,
    },
    "2023": {
      turnover: 16_200_000,
      plnpbt: 1_700_000,
      plnpat: 1_500_000,
      bsqpuc: 2_200_000,
      networth: 2_200_000,
      bsfatot: 1_600_000,
      othass: 1_100_000,
      bscatot: 5_200_000,
      bsclbank: 950_000,
      curlib: 3_100_000,
      bsslltd: 550_000,
      bsclstd: 250_000,
    },
    "2024": {
      turnover: 18_600_000,
      plnpbt: 2_000_000,
      plnpat: 1_800_000,
      bsqpuc: 2_400_000,
      networth: 2_400_000,
      bsfatot: 1_700_000,
      othass: 1_200_000,
      bscatot: 5_800_000,
      bsclbank: 1_000_000,
      curlib: 3_400_000,
      bsslltd: 600_000,
      bsclstd: 300_000,
    },
  },
};


const liveCtosFinancials = Object.entries(liveFinancialStatements.unaudited_by_year).map(([year, raw]) => ({
  financial_year: Number(year),
  dates: { pldd: `${year}-12-31`, bsdd: null as null },
  account: raw as Record<string, number>,
}));

const frozenPage1 = {
  issuer_track_record: {
    total_notes_funded: 1,
    total_amount_funded: "100000",
    successful_repayment_percent: 100,
    on_time_payment_rate_six_months_percent: 100,
    calculated_at: "2026-07-01T00:00:00.000Z",
  },
  historical_notes: [] as const,
};

function row(
  rows: Array<{ key: string; values: string[] }>,
  key: string
): string[] | undefined {
  return rows.find((r) => r.key === key)?.values;
}

describe("prospectus Page 3 Prisma mapper and assembly", () => {
  describe("shared snapshot extension", () => {
    it("freezes original and extended raw keys without formatted or narrative content", () => {
      const page2 = buildProspectusPage2Snapshot({
        financialStatements: liveFinancialStatements,
        ctosFinancials: liveCtosFinancials,
      });
      const raw = page2.financial_comparison.selected_years[0]?.raw_financials;
      expect(PROSPECTUS_PAGE_TWO_RAW_FINANCIAL_KEYS).toEqual([
        "turnover",
        "plnpat",
        "bsqpuc",
        "bscatot",
        "curlib",
        "plnpbt",
        "bsfatot",
        "othass",
        "bsclbank",
        "bsslltd",
        "bsclstd",
        "totass",
        "totlib",
        "networth",
        "profit_margin",
        "return_on_equity",
        "currat",
        "gear",
      ]);
      expect(raw?.plnpbt).toBe(1_400_000);
      expect(raw?.bsfatot).toBe(1_500_000);
      expect(raw?.othass).toBe(1_000_000);
      expect(raw?.bsclbank).toBe(900_000);
      expect(raw?.bsslltd).toBe(500_000);
      expect(raw?.bsclstd).toBe(200_000);
      expect(raw?.turnover).toBe(13_900_000);
      expect(raw?.networth).toBe(2_000_000);
      expect(raw).toHaveProperty("totass");
      expect(raw).toHaveProperty("totlib");

      const serialized = JSON.stringify(page2);
      expect(serialized).not.toMatch(/RM /);
      expect(serialized).not.toMatch(/Trend|Takeaway/i);
      expect(serialized).not.toMatch(/organization_ctos|CCRIS|RegTank/i);
    });

    it("merges page_2 without creating page_3 financial_comparison or dropping unknown branches", () => {
      const page2 = buildProspectusPage2Snapshot({
        financialStatements: liveFinancialStatements,
        ctosFinancials: liveCtosFinancials,
      });
      const merged = wrapProspectusSnapshotWithPageTwo(frozenPage1, page2, {
        page_1: { old: true },
        future_branch: { keep: true },
        page_3: { investor_takeaways: { should_not_be_required: true } },
      });
      expect(merged.page_1).toEqual(frozenPage1);
      expect(merged.page_2).toEqual(page2);
      expect((merged as Record<string, unknown>).future_branch).toEqual({ keep: true });
      expect((merged as Record<string, unknown>).page_3).toEqual({
        investor_takeaways: { should_not_be_required: true },
      });
      expect(JSON.stringify(merged.page_2)).not.toContain("investor_takeaways");
    });
  });

  describe("Prisma select and publication rule", () => {
    it("selects only Page 3 Note fields and uses published + published_at", () => {
      expect(PROSPECTUS_PAGE_THREE_NOTE_SELECT).toEqual({
        id: true,
        status: true,
        published_at: true,
        source_application_id: true,
        issuer_organization_id: true,
        issuer_snapshot: true,
        invoice_snapshot: true,
        paymaster_snapshot: true,
        prospectus_snapshot: true,
      });
      expect(JSON.stringify(PROSPECTUS_PAGE_THREE_NOTE_SELECT)).not.toContain("ctos");
      expect(PROSPECTUS_PAGE_THREE_NOTE_SELECT).not.toHaveProperty("issuer_organization");
      expect(
        isProspectusNotePublished({
          status: NoteStatus.PUBLISHED,
          published_at: new Date(),
        })
      ).toBe(true);
      expect(
        isProspectusNotePublished({
          status: NoteStatus.PUBLISHED,
          published_at: null,
        })
      ).toBe(false);
    });
  });

  describe("published vs unpublished mapping", () => {
    it("uses frozen page_2 financials for published Notes and ignores live Application data", () => {
      const frozen = buildProspectusPage2Snapshot({
        financialStatements: liveFinancialStatements,
        ctosFinancials: liveCtosFinancials,
      }).financial_comparison;
      const changedLive = {
        ...liveFinancialStatements,
        unaudited_by_year: {
          "2024": { turnover: 999, plnpat: 1, bsqpuc: 1, bscatot: 1, curlib: 1 },
        },
      };
      const data: ProspectusPageThreeLoadedData = {
        note: baseNote({
          status: NoteStatus.PUBLISHED,
          published_at: new Date("2026-07-01T00:00:00.000Z"),
          prospectus_snapshot: {
            page_1: frozenPage1,
            page_2: { financial_comparison: frozen },
          },
        }),
        liveFinancialStatements: changedLive,
          liveCtosFinancials: null,
      };

      const input = mapProspectusPageThreeDataToInput(data);
      expect(input.financialMode).toBe("frozen_publication_snapshot");
      expect(input.liveFinancialStatements).toBeNull();

      const page = buildProspectusPageThree(input);
      expect(row(page.incomeStatement.rows, "revenue")?.[0]).toBe("13.9");
      expect(row(page.incomeStatement.rows, "profit_before_tax")?.[0]).toBe("1.4");
      expect(page.financialSource.years.map((y) => y.year)).toEqual([2022, 2023, 2024]);
    });

    it("does not live-fallback when published snapshot is missing or malformed", () => {
      const missing = buildProspectusPageThree(
        mapProspectusPageThreeDataToInput({
          note: baseNote({
            status: NoteStatus.PUBLISHED,
            published_at: new Date(),
            prospectus_snapshot: { page_1: frozenPage1 },
          }),
          liveFinancialStatements: liveFinancialStatements,
          liveCtosFinancials,
        })
      );
      expect(missing.meta.financialMode).toBe("published_unavailable");
      expect(missing.financialSource.years).toEqual([]);
      expect(missing.metadata.metadata).not.toHaveProperty("issuer");
      expect(missing.metadata.metadata.sector).toBe("Construction | —");

      const malformed = buildProspectusPageThree(
        mapProspectusPageThreeDataToInput({
          note: baseNote({
            status: NoteStatus.PUBLISHED,
            published_at: new Date(),
            prospectus_snapshot: {
              page_2: { financial_comparison: { source: "wrong" } },
            },
          }),
          liveFinancialStatements: liveFinancialStatements,
          liveCtosFinancials,
        })
      );
      expect(malformed.meta.financialMode).toBe("published_unavailable");
      expect(malformed.financialSource.years).toEqual([]);
    });

    it("uses live Application Stage 4A source for unpublished Notes", () => {
      const page = buildProspectusPageThree(
        mapProspectusPageThreeDataToInput({
          note: baseNote(),
          liveFinancialStatements,
          liveCtosFinancials,
        })
      );
      expect(page.meta.financialMode).toBe("live_unpublished_preview");
      expect(page.financialSource.years.map((y) => y.year)).toEqual([2022, 2023, 2024]);
      expect(row(page.incomeStatement.rows, "revenue")).toEqual(["13.9", "16.2", "18.6"]);
    });

    it("supports old published freeze without extended keys", () => {
      const oldFreeze = {
        source: "application_financial_statements" as const,
        calculated_at: "2026-01-01T00:00:00.000Z",
        selected_years: [
          {
            year: 2024,
            year_label: "FY2024",
            financial_year_end_label: "31 Dec 2024",
            raw_financials: {
              turnover: 18_600_000,
              plnpat: 1_800_000,
              bsqpuc: 2_400_000,
              bscatot: 5_800_000,
              curlib: 3_400_000,
            },
          },
        ],
      };
      const parsed = parseProspectusPageTwoSnapshot({ page_2: { financial_comparison: oldFreeze } });
      expect(parsed).not.toBeNull();

      const page = buildProspectusPageThree({
        noteId: "old",
        isPublished: true,
        financialMode: "frozen_publication_snapshot",
        issuerSnapshot: { name: "Old Issuer", industry: "Construction" },
        invoiceSnapshot: { offer_details: { risk_rating: "A" } },
        paymasterSnapshot: { name: "Old Paymaster" },
        liveFinancialStatements: null,
          liveCtosFinancials: null,
        frozenFinancialComparison: parsed!.financial_comparison,
      });

      // Display pad: FY2022 | FY2023 | FY2024 — only the real freeze year has values.
      expect(page.incomeStatement.years.map((y) => y.year)).toEqual([2022, 2023, 2024]);
      expect(row(page.incomeStatement.rows, "revenue")).toEqual([
        PROSPECTUS_DATA_NOT_AVAILABLE,
        PROSPECTUS_DATA_NOT_AVAILABLE,
        "18.6",
      ]);
      expect(row(page.incomeStatement.rows, "profit_after_tax")).toEqual([
        PROSPECTUS_DATA_NOT_AVAILABLE,
        PROSPECTUS_DATA_NOT_AVAILABLE,
        "1.8",
      ]);
      expect(row(page.incomeStatement.rows, "profit_before_tax")?.[2]).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );
      expect(row(page.balanceSheet.rows, "current_assets")?.[2]).toBe("5.8");
      // Old freeze without totass/totlib → DNA (no component reconstruction).
      expect(row(page.balanceSheet.rows, "total_assets")?.[2]).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );
      expect(row(page.balanceSheet.rows, "total_liabilities")?.[2]).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );
      // Old freeze without return_on_equity → DNA (no PAT/networth fallback).
      expect(row(page.coverageEfficiency.rows, "return_on_equity")?.[2]).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );
      expect(row(page.balanceSheet.rows, "cash_and_bank")?.[2]).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );
      expect(row(page.balanceSheet.rows, "total_equity")?.[2]).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );
    });
  });

  describe("stage composition", () => {
    it("maps metadata from frozen Note snapshots", () => {
      const page = SAMPLE_PROSPECTUS_PAGE_THREE;
      expect(page.metadata.pageTitle).toBe("DETAILED FINANCIAL COMPARISON");
      expect(page.metadata.pageSubtitle).toBe(
        "Additional financial view for investors seeking deeper issuer analysis"
      );
      expect(page.metadata.metadata).not.toHaveProperty("issuer");
      expect(page.metadata.metadata.sector).toBe("Construction | Medium");
      expect(page.metadata.metadata.riskRating).toBe("B");
      expect(page.metadata.metadata.paymaster).toBe("Kementerian Kerja Raya");
      expect(page.metadata.metadata.paymasterGrading).toBe("PM1");
      expect(page.metadata.metadata.confidenceGrading).toBe("High");

      const invalid = buildProspectusPageThree({
        ...mapProspectusPageThreeDataToInput({
          note: baseNote({
            invoice_snapshot: { offer_details: { risk_rating: "AAA" } },
          }),
          liveFinancialStatements,
          liveCtosFinancials,
        }),
      });
      expect(invalid.metadata.metadata.riskRating).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    });

    it("maps confirmed income, balance sheet, and ROE; sample fills unsupported gaps only", () => {
      const page = SAMPLE_PROSPECTUS_PAGE_THREE;
      expect(row(page.incomeStatement.rows, "gross_profit")?.[0]).toBe("2.1");
      expect(row(page.incomeStatement.rows, "ebitda")?.[0]).toBe("1.6");
      expect(row(page.incomeStatement.rows, "ebit")?.[0]).toBe("1.4");
      expect(row(page.incomeStatement.rows, "profit_before_tax")?.[0]).toBe("1.4");
      expect(row(page.balanceSheet.rows, "total_assets")?.[0]).toBe("8.1");
      expect(row(page.balanceSheet.rows, "cash_and_bank")?.[0]).toBe("0.9");
      expect(row(page.balanceSheet.rows, "quick_ratio")?.[0]).toBe("1.11x");
      expect(row(page.coverageEfficiency.rows, "return_on_equity")?.[0]).toBe("60%");
      expect(row(page.coverageEfficiency.rows, "dscr")?.[0]).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );
      // Sample has totlib but no gear → gearing from totlib/networth
      expect(row(page.coverageEfficiency.rows, "debt_equity")?.[0]).not.toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );

      const page2Npm = buildProspectusFinancialComparisonMetrics({
        source: page.financialSource,
      }).rows.find((r) => r.key === "netProfitMargin")?.values;
      expect(row(page.incomeStatement.rows, "net_profit_margin")).toEqual(page2Npm);
    });

    it("keeps income/balance trends unavailable; sample preview uses officer-selected takeaways", () => {
      const page = SAMPLE_PROSPECTUS_PAGE_THREE;
      expect(page.trends.trends).toHaveLength(26);
      expect(page.trends.trends.slice(0, 16).every((t) => t.approved === false)).toBe(true);
      // Officer-only coverage rows stay unavailable without manuals; ROE may approve from raw years
      expect(
        page.trends.trends.find((t) => t.metricKey === "operating_cash_flow")?.approved
      ).toBe(false);
      expect(page.investorTakeaways.items).toHaveLength(6);
      expect(page.investorTakeaways.items[0]?.takeaway).toContain(
        "steady year-on-year growth"
      );
      expect(page.investorTakeaways.omittedKeys).toEqual([]);
      expect(page.investorTakeaways.sectionHeading).toBe("4. INVESTOR TAKEAWAYS");

      const prismaPath = buildProspectusPageThree(
        mapProspectusPageThreeDataToInput({
          note: baseNote(),
          liveFinancialStatements,
          liveCtosFinancials,
        })
      );
      expect(
        prismaPath.investorTakeaways.items.every(
          (i) => i.takeaway === PROSPECTUS_DATA_NOT_AVAILABLE
        )
      ).toBe(true);
    });

    it("omits Issuer metadata; keeps shared header Shariah badge", () => {
      const html = renderProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
      expect(html).not.toMatch(/\bIssuer\b/);
      expect(html).not.toContain("Issuer:");
      expect(html).not.toContain("ABC Engineering");
      expect(html).not.toContain("202001234567");
      expect(html).not.toContain("SSM");
      expect(html).toContain("Shariah Compliant");
      expect(html).toContain('data-stage="header"');
      expect(html).toContain("CashSouk");
      expect(html).toContain("Sector");
      expect(html).toContain("Construction | Medium");
      expect(html).toContain("Paymaster Grading");
      expect(html).toContain("PM1");
      expect(html).toContain("Confidence Grading");
      expect(html).toContain("High");
      expect(html).toContain("meta-strip");
      expect(html).toContain("grid-template-columns:repeat(5,minmax(0,1fr))");
      expect(html).not.toContain("source-statement");
      expect(html).not.toContain("page-footer-group");
      expect(html).toContain("financial-source");
      expect(html).toContain("Source:");
      expect(html.indexOf("financial-source")).toBeLessThan(
        html.indexOf('class="prospectus-footer"')
      );
      expect(html).toContain('data-stage="footer"');
      expect(html).toContain("prospectus-footer");
      expect(html).not.toContain("Data not available");
    });

    it("reuses Page 2 officer gradings for Page 3 metadata strip", () => {
      const page = buildProspectusPageThree({
        ...SAMPLE_PROSPECTUS_PAGE_THREE_INPUT,
        publicationContent: {
          ...PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT,
          invoicePaymaster: {
            deedOfAssignment: "Yes",
            paymasterRating: "PM4",
            confidenceGrading: "Medium",
          },
        },
      });
      expect(page.metadata.metadata.paymasterGrading).toBe("PM4");
      expect(page.metadata.metadata.confidenceGrading).toBe("Medium");
      expect(page.metadata.audit.paymasterGrading.page3StorageAllowed).toBe(false);
      expect(page.metadata.audit.confidenceGrading.page3StorageAllowed).toBe(false);
    });
  });

  describe("HTML assembly — six visible content stages", () => {
    it("defines exactly six visible content stages (integration is not a stage)", () => {
      expect(PROSPECTUS_PAGE_THREE_VISIBLE_CONTENT_STAGES).toHaveLength(6);
      expect(PROSPECTUS_PAGE_THREE_VISIBLE_CONTENT_STAGES).toEqual([
        "page_title",
        "metadata_strip",
        "income_statement",
        "balance_sheet_liquidity",
        "coverage_efficiency_with_trends",
        "investor_takeaways",
      ]);
      expect(SAMPLE_PROSPECTUS_PAGE_THREE).not.toHaveProperty("footer");
    });

    it("assembles one A4 Page 3 in reference order with Stage 5 Trend column only", () => {
      const html = renderProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
      expect(html).toContain('data-page="prospectus-page-three"');
      expect(html.match(/data-page="prospectus-page-three"/g)).toHaveLength(1);
      expect(html).toContain(`width:${PROSPECTUS_PAGE_THREE_WIDTH_MM}mm`);
      expect(html).toContain(`height:${PROSPECTUS_PAGE_THREE_HEIGHT_MM}mm`);
      expect(html).toContain(`min-width:${PROSPECTUS_PAGE_THREE_WIDTH_MM}mm`);
      expect(html).toContain(`min-height:${PROSPECTUS_PAGE_THREE_HEIGHT_MM}mm`);
      expect(PROSPECTUS_PAGE_THREE_WIDTH_MM).toBe(210);
      expect(PROSPECTUS_PAGE_THREE_HEIGHT_MM).toBe(297);

      const stageOrder = [
        'data-stage="header"',
        'data-content-stage="page-title"',
        'data-content-stage="metadata-strip"',
        'data-content-stage="income-statement"',
        'data-content-stage="balance-sheet-liquidity"',
        'data-content-stage="coverage-efficiency"',
        'data-content-stage="investor-takeaways"',
      ];
      let cursor = -1;
      for (const marker of stageOrder) {
        const idx = html.indexOf(marker);
        expect(idx).toBeGreaterThan(cursor);
        cursor = idx;
      }
      const takeawaysIdx = html.indexOf('data-content-stage="investor-takeaways"');
      expect(html.lastIndexOf("data-content-stage=")).toBe(takeawaysIdx);
      expect(html).not.toContain("source-statement");
      expect(html).not.toContain("page-footer-group");
      expect(html).toContain("financial-source");
      expect(html).toContain("Source:");
      expect(html.indexOf("financial-source")).toBeLessThan(
        html.indexOf('class="prospectus-footer"')
      );
      expect(html).toContain('data-stage="footer"');
      expect(html).toContain("prospectus-footer");
      expect(html).not.toContain("Source Note:");
      expect(html).toContain("Product Terms and Risk Disclosure Statement");
      expect(html).toContain("Investments are subject to credit risk");
      expect(html).not.toContain("Investment are subjects");
      expect(html).not.toContain("Data not available");
      expect(html).not.toContain(">N/A<");
      expect(html).not.toContain("Unavailable");

      expect(html).toContain('data-stage="1"');
      expect(html).toContain('data-stage="2"');
      expect(html).toContain('data-stage="3"');
      expect(html).toContain('data-stage="4"');
      expect(html).toContain('data-stage="5"');
      expect(html).toContain('data-stage="6"');

      expect(html).toContain("DETAILED FINANCIAL COMPARISON");
      expect(html).toContain(
        "Additional financial view for investors seeking deeper issuer analysis"
      );
      expect(html).toContain('data-page-subtitle="true"');
      expect(html).toContain("Trend (3-Yr)");
      expect(html).not.toContain("FINANCIAL TRENDS");
      expect((html.match(/class="trend-cell/g) ?? []).length).toBe(10);
      expect(html).not.toMatch(/[↑↓]/);
      expect(html).toContain("comparison-grid");
      expect(html).not.toContain("comparison-row-top");
      expect(html).not.toContain("comparison-row-bottom");
      expect(html).not.toContain("page-bottom");
      expect(html).toContain("coverage-table");
      expect(html).toContain('data-meta-key="sector"');
      expect(html).toContain('data-meta-key="riskRating"');
      expect(html).toContain('data-meta-key="paymaster"');
      expect(html).toContain('data-meta-key="paymasterGrading"');
      expect(html).toContain('data-meta-key="confidenceGrading"');

      expect(html).toContain("3-YEAR INCOME STATEMENT SUMMARY (MYR mil.)");
      expect(html).toContain("prospectus-income-trend-insight");
      expect(html).toContain("prospectus-income-trend-insight--positive");
      expect(html).toContain('data-income-trend-insight="true"');
      expect(html).toContain(
        "Revenue and profit show consistent growth over the past three financial years."
      );
      expect(html).toContain("3-YEAR BALANCE SHEET &amp; LIQUIDITY (MYR mil.)");
      expect(html).toContain("13.9");
      expect(html).toContain("2.1");
      expect(html).toContain("8.1");
      expect(html).not.toContain("RM 13,900,000.00");
      expect(html).not.toContain("RM 8,100,000.00");
      expect(html).not.toMatch(/RM\s*mil/i);
      expect(html).not.toContain("clsamplepage3");
      expect(html).not.toContain("unaudited_by_year");
      expect(html).not.toContain("page_2_financial_comparison_source");
      expect(html).not.toMatch(/CTOS|CCRIS|RegTank|AML|KYC/);
      expect(html).toContain("steady year-on-year growth");
      expect(html).toContain("strengthening fundamentals");
      expect(html).not.toMatch(/strong investment case|recommended investment|low risk/i);
      expect(html).not.toMatch(/[↑↓▲▼]/);
      expect(html).not.toContain("calculateGearing");
      expect(html).not.toContain("Cash & Bank</th><td>RM");
    });

    it("does not add Trend columns to income or balance sheet tables", () => {
      const html = renderProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
      const incomeIdx = html.indexOf('data-content-stage="income-statement"');
      const balanceIdx = html.indexOf('data-content-stage="balance-sheet-liquidity"');
      const coverageIdx = html.indexOf('data-content-stage="coverage-efficiency"');
      const incomeChunk = html.slice(incomeIdx, balanceIdx);
      const balanceChunk = html.slice(balanceIdx, coverageIdx);
      expect(incomeChunk).not.toContain("Trend (3-Yr)");
      expect(balanceChunk).not.toContain("Trend (3-Yr)");
      expect(html.slice(coverageIdx)).toContain("Trend (3-Yr)");
    });
  });
});
