import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NoteStatus } from "@prisma/client";
import {
  resolveCtosPatMarginPercent,
  MARKETPLACE_MIN_COMMIT_MYR,
} from "@cashsouk/types";
import { AppError } from "../../../lib/http/error-handler";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import { parseProspectusPageTwoSnapshot } from "./prospectus-json-guards";
import {
  buildFinancialComparisonSourceFromFrozen,
  buildProspectusPageTwo,
  mapProspectusPageTwoDataToInput,
} from "./prospectus-page-two-mapper";
import {
  buildProspectusFinancialComparisonMetrics,
  formatProspectusFinancialPercentFromPoints,
} from "./prospectus-financial-comparison-metrics";
import {
  isProspectusNotePublished,
  loadProspectusPageTwoData,
  PROSPECTUS_PAGE_TWO_NOTE_SELECT,
  type ProspectusPageTwoLoadedData,
  type ProspectusPageTwoNoteRecord,
} from "./prospectus-page-two-prisma";
import {
  buildProspectusPage2Snapshot,
  wrapProspectusSnapshotWithPageTwo,
} from "./prospectus-page-two-snapshot";
import { SAMPLE_PROSPECTUS_PAGE_TWO } from "./prospectus-page-two.sample-data";
import {
  PROSPECTUS_PAGE_TWO_HEIGHT_MM,
  PROSPECTUS_PAGE_TWO_WIDTH_MM,
} from "./prospectus-page-two.types";
import { PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT } from "./prospectus-placeholder-publication-content";
import {
  PROSPECTUS_INVEST_CTA_DESCRIPTION,
  PROSPECTUS_RISK_SCALE_NOTE,
} from "./prospectus-static-copy";
import { renderProspectusPageTwoHtml } from "./render-prospectus-page-two";

function baseNote(
  overrides: Partial<ProspectusPageTwoNoteRecord> = {}
): ProspectusPageTwoNoteRecord {
  return {
    id: "clsamplepage2note0001",
    note_reference: "NOTE-P2-0001",
    status: NoteStatus.DRAFT,
    published_at: null,
    source_application_id: "app-1",
    issuer_organization_id: "org-1",
    maturity_date: new Date("2026-12-31T00:00:00.000Z"),
    target_amount: 500_000,
    funded_amount: 0,
    issuer_snapshot: {
      name: "Issuer Co",
      registration_number: "1234567890",
      industry: "Construction",
      country: "Malaysia",
      business_description: "Infrastructure works",
    },
    invoice_snapshot: {
      details: { value: 625_000 },
      offer_details: { risk_rating: "B" },
    },
    paymaster_snapshot: {
      name: "Paymaster Co",
      entity_type: "GOVERNMENT_LINKED",
    },
    prospectus_snapshot: null,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-02T00:00:00.000Z"),
    listing: {
      opens_at: new Date("2026-01-10T00:00:00.000Z"),
      closes_at: new Date("2026-01-20T00:00:00.000Z"),
      status: "DRAFT",
    },
    ...overrides,
  };
}

const liveFinancialStatements = {
  questionnaire: { financial_year_end: "2027-12-31" },
  unaudited_by_year: {
    "2021": { turnover: 1, plnpat: 1, bsqpuc: 1, bscatot: 1, curlib: 1 },
    "2022": {
      turnover: 12_000_000,
      plnpat: 900_000,
      bsqpuc: 5_000_000,
      bscatot: 4_000_000,
      curlib: 2_000_000,
    },
    "2023": {
      turnover: 13_900_000,
      plnpat: 1_100_000,
      bsqpuc: 5_500_000,
      bscatot: 4_200_000,
      curlib: 2_100_000,
    },
    "2024": {
      turnover: 15_000_000,
      plnpat: 1_200_000,
      bsqpuc: 6_000_000,
      bscatot: 4_500_000,
      curlib: 2_200_000,
    },
  },
};

/** CTOS rows matching Admin Financial Statements latest-three selection. */
const liveCtosFinancials = [
  {
    financial_year: 2022,
    dates: { pldd: "2022-12-31", bsdd: null },
    account: {
      turnover: 12_000_000,
      plnpat: 900_000,
      bsqpuc: 5_000_000,
      bscatot: 4_000_000,
      curlib: 2_000_000,
    },
  },
  {
    financial_year: 2023,
    dates: { pldd: "2023-12-31", bsdd: null },
    account: {
      turnover: 13_900_000,
      plnpat: 1_100_000,
      bsqpuc: 5_500_000,
      bscatot: 4_200_000,
      curlib: 2_100_000,
    },
  },
  {
    financial_year: 2024,
    dates: { pldd: "2024-12-31", bsdd: null },
    account: {
      turnover: 15_000_000,
      plnpat: 1_200_000,
      bsqpuc: 6_000_000,
      bscatot: 4_500_000,
      curlib: 2_200_000,
    },
  },
];

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

describe("prospectus Page 2 Prisma mapper and assembly", () => {
  describe("publication rule and select", () => {
    it("uses PUBLISHED and published_at together", () => {
      expect(
        isProspectusNotePublished({ status: NoteStatus.PUBLISHED, published_at: new Date() })
      ).toBe(true);
      expect(
        isProspectusNotePublished({ status: NoteStatus.PUBLISHED, published_at: null })
      ).toBe(false);
      expect(
        isProspectusNotePublished({ status: NoteStatus.DRAFT, published_at: new Date() })
      ).toBe(false);
    });

    it("selects only required Page 2 fields and not CTOS/live org", () => {
      expect(PROSPECTUS_PAGE_TWO_NOTE_SELECT).toMatchObject({
        issuer_snapshot: true,
        invoice_snapshot: true,
        paymaster_snapshot: true,
        prospectus_snapshot: true,
        target_amount: true,
        funded_amount: true,
      });
      expect(PROSPECTUS_PAGE_TWO_NOTE_SELECT).not.toHaveProperty("ctos");
      expect(JSON.stringify(PROSPECTUS_PAGE_TWO_NOTE_SELECT)).toContain("issuer_organization_id");
      expect(PROSPECTUS_PAGE_TWO_NOTE_SELECT).not.toHaveProperty("issuer_organization");
    });
  });

  describe("publication snapshot freeze", () => {
    it("freezes Stage 4 years and raw values without formatted money", () => {
      const page2 = buildProspectusPage2Snapshot({
        financialStatements: {
          questionnaire: { financial_year_end: "2027-12-31" },
          unaudited_by_year: {},
        },
        ctosFinancials: [
          {
            financial_year: 2022,
            dates: { pldd: "2022-12-31", bsdd: null },
            account: { turnover: 12_000_000, plnpat: 900_000, bsqpuc: 5_000_000, bscatot: 4_000_000, curlib: 2_000_000 },
          },
          {
            financial_year: 2023,
            dates: { pldd: "2023-12-31", bsdd: null },
            account: { turnover: 13_900_000, plnpat: 1_100_000, bsqpuc: 5_500_000, bscatot: 4_200_000, curlib: 2_100_000 },
          },
          {
            financial_year: 2024,
            dates: { pldd: "2024-12-31", bsdd: null },
            account: { turnover: 15_000_000, plnpat: 1_200_000, bsqpuc: 6_000_000, bscatot: 4_500_000, curlib: 2_200_000 },
          },
        ],
        now: new Date("2026-07-19T12:00:00.000Z"),
      });

      expect(page2.financial_comparison.source).toBe("admin_financial_statements_normalized");
      expect(page2.financial_comparison.selected_years.map((y) => y.year)).toEqual([
        2022, 2023, 2024,
      ]);
      expect(page2.financial_comparison.selected_years[2]?.raw_financials.turnover).toBe(
        15_000_000
      );
      expect(page2.financial_comparison.calculated_at).toBe("2026-07-19T12:00:00.000Z");

      expect(page2.config_versions?.soukscore_scale).toBe("2026.07.23.cashsouk-risk-scale.v1");
      expect(page2.config_versions?.legal_copy).toBeNull();
      expect(page2.config_versions?.marketing_copy).toBeNull();

      const serialized = JSON.stringify(page2);
      expect(serialized).not.toMatch(/RM /);
      expect(serialized).not.toMatch(/CCRIS|RegTank/i);
      expect(serialized).not.toMatch(/organization_ctos/i);
      expect(serialized).not.toMatch(/attractive return|Shariah-compliant/i);
    });

    it("extends shared freeze with Page 3 raw keys and preserves zeros", () => {
      const page2 = buildProspectusPage2Snapshot({
        financialStatements: {
          questionnaire: { financial_year_end: "2027-12-31" },
          unaudited_by_year: {},
        },
        ctosFinancials: [
          {
            financial_year: 2024,
            dates: { pldd: "2024-12-31", bsdd: null },
            account: {
              turnover: 15_000_000,
              plnpat: 1_200_000,
              bsqpuc: 6_000_000,
              bscatot: 4_500_000,
              curlib: 2_200_000,
              plnpbt: 1_400_000,
              bsfatot: 0,
              othass: 1_200_000,
              bsclbank: 1_000_000,
              bsslltd: 600_000,
              bsclstd: 300_000,
              totass: 8_400_000,
              totlib: 3_100_000,
            },
          },
        ],
        now: new Date("2026-07-19T12:00:00.000Z"),
      });
      const raw = page2.financial_comparison.selected_years[0]?.raw_financials;
      expect(raw).toMatchObject({
        turnover: 15_000_000,
        plnpat: 1_200_000,
        bsqpuc: 6_000_000,
        bscatot: 4_500_000,
        curlib: 2_200_000,
        plnpbt: 1_400_000,
        bsfatot: 0,
        othass: 1_200_000,
        bsclbank: 1_000_000,
        bsslltd: 600_000,
        bsclstd: 300_000,
        totass: 8_400_000,
        totlib: 3_100_000,
        networth: null,
        profit_margin: null,
        return_on_equity: null,
        currat: null,
        gear: null,
      });
      expect(JSON.stringify(page2)).not.toMatch(/RM /);
      expect(JSON.stringify(page2)).not.toMatch(/Trend|Takeaway|Cash & Bank/i);
    });

    it("parses old published snapshots missing extended keys as null", () => {
      const parsed = parseProspectusPageTwoSnapshot({
        page_2: {
          financial_comparison: {
            source: "application_financial_statements",
            calculated_at: "2026-01-01T00:00:00.000Z",
            selected_years: [
              {
                year: 2024,
                year_label: "FY2024",
                financial_year_end_label: "31 Dec 2024",
                raw_financials: {
                  turnover: 100,
                  plnpat: 10,
                  bsqpuc: 50,
                  bscatot: 40,
                  curlib: 20,
                },
              },
            ],
          },
        },
      });
      expect(parsed?.financial_comparison.selected_years[0]?.raw_financials.plnpbt).toBeNull();
      expect(parsed?.financial_comparison.selected_years[0]?.raw_financials.bsfatot).toBeNull();
      expect(parsed?.financial_comparison.selected_years[0]?.raw_financials.bsclbank).toBeNull();
      expect(parsed?.financial_comparison.selected_years[0]?.raw_financials.networth).toBeNull();
      expect(parsed?.financial_comparison.selected_years[0]?.raw_financials.profit_margin).toBeNull();
      expect(parsed?.financial_comparison.selected_years[0]?.raw_financials.return_on_equity).toBeNull();
      expect(parsed?.financial_comparison.selected_years[0]?.raw_financials.currat).toBeNull();
    });

    it("freezes corrected NPM/ROE inputs; published HTML ignores later CTOS changes", () => {
      const frozen = buildProspectusPage2Snapshot({
        financialStatements: {
          questionnaire: { financial_year_end: "2027-12-31" },
          unaudited_by_year: {},
        },
        ctosFinancials: [
          {
            financial_year: 2024,
            dates: { pldd: "2024-12-31", bsdd: null },
            account: {
              turnover: 100,
              plnpat: 15,
              profit_margin: 20,
              networth: 500,
              bsqpuc: 200,
              return_on_equity: null,
              bscatot: 1,
              curlib: 1,
            },
          },
        ],
        now: new Date("2026-07-19T12:00:00.000Z"),
      }).financial_comparison;

      const raw = frozen.selected_years[0]?.raw_financials;
      expect(raw?.turnover).toBe(100);
      expect(raw?.plnpat).toBe(15);
      expect(raw?.profit_margin).toBe(20);
      expect(raw?.networth).toBe(500);
      expect(raw?.bsqpuc).toBe(200);

      const previewSource = buildFinancialComparisonSourceFromFrozen(frozen);
      const previewMetrics = buildProspectusFinancialComparisonMetrics({ source: previewSource });
      expect(previewMetrics.rows.find((r) => r.key === "netProfitMargin")?.values[0]).toBe(
        formatProspectusFinancialPercentFromPoints(resolveCtosPatMarginPercent({ plnpat: 15, turnover: 100 }))
      );
      expect(previewMetrics.rows.find((r) => r.key === "roe")?.values[0]).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );

      const published = buildProspectusPageTwo(
        mapProspectusPageTwoDataToInput({
          note: baseNote({
            status: NoteStatus.PUBLISHED,
            published_at: new Date("2026-07-01T00:00:00.000Z"),
            prospectus_snapshot: {
              page_1: frozenPage1,
              page_2: { financial_comparison: frozen },
            },
          }),
          liveFinancialStatements: {
            questionnaire: { financial_year_end: "2027-12-31" },
            unaudited_by_year: {
              "2024": {
                turnover: 999,
                plnpat: 1,
                profit_margin: 99,
                networth: 1,
                bsqpuc: 1,
                bscatot: 1,
                curlib: 1,
              },
            },
          },
          liveCtosFinancials: [
            {
              financial_year: 2024,
              dates: { pldd: "2024-12-31", bsdd: null },
              account: {
                turnover: 999,
                plnpat: 1,
                profit_margin: 99,
                networth: 1,
                bsqpuc: 1,
              },
            },
          ],
        })
      );

      expect(published.financialComparisonSource.years.map((y) => y.year)).toEqual([
        2022, 2023, 2024,
      ]);
      const fy2024 = published.financialComparisonSource.years.find((y) => y.year === 2024);
      expect(fy2024?.rawFinancials.turnover).toBe(100);
      expect(fy2024?.rawFinancials.plnpat).toBe(15);
      expect(fy2024?.rawFinancials.networth).toBe(500);
      expect(
        published.financialComparisonMetrics.rows.find((r) => r.key === "netProfitMargin")?.values[2]
      ).toBe(
        formatProspectusFinancialPercentFromPoints(
          resolveCtosPatMarginPercent({ plnpat: 15, turnover: 100 })
        )
      );
      expect(published.financialComparisonMetrics.rows.find((r) => r.key === "roe")?.values[2]).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );
    });

    it("freezes totass/totlib raw fields; ROE stays DNA without return_on_equity; published HTML ignores later CTOS changes", () => {
      const frozen = buildProspectusPage2Snapshot({
        financialStatements: {
          questionnaire: { financial_year_end: "2027-12-31" },
          unaudited_by_year: {},
        },
        ctosFinancials: [
          {
            financial_year: 2024,
            dates: { pldd: "2024-12-31", bsdd: null },
            account: {
              turnover: 100,
              plnpat: 100,
              return_on_equity: null,
              networth: null,
              totass: 700,
              totlib: 200,
              bsqpuc: 200,
              bscatot: 1,
              curlib: 1,
            },
          },
        ],
        now: new Date("2026-07-19T12:00:00.000Z"),
      }).financial_comparison;

      const raw = frozen.selected_years[0]?.raw_financials;
      expect(raw?.plnpat).toBe(100);
      expect(raw?.return_on_equity).toBeNull();
      expect(raw?.networth).toBeNull();
      expect(raw?.totass).toBe(700);
      expect(raw?.totlib).toBe(200);
      expect(raw?.bsqpuc).toBe(200);

      const previewSource = buildFinancialComparisonSourceFromFrozen(frozen);
      const previewMetrics = buildProspectusFinancialComparisonMetrics({ source: previewSource });
      expect(previewMetrics.rows.find((r) => r.key === "roe")?.values[0]).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );

      const published = buildProspectusPageTwo(
        mapProspectusPageTwoDataToInput({
          note: baseNote({
            status: NoteStatus.PUBLISHED,
            published_at: new Date("2026-07-01T00:00:00.000Z"),
            prospectus_snapshot: {
              page_1: frozenPage1,
              page_2: { financial_comparison: frozen },
            },
          }),
          liveFinancialStatements: {
            questionnaire: { financial_year_end: "2027-12-31" },
            unaudited_by_year: {
              "2024": {
                turnover: 999,
                plnpat: 1,
                networth: 1,
                totass: 1,
                totlib: 1,
                bsqpuc: 1,
                bscatot: 1,
                curlib: 1,
              },
            },
          },
          liveCtosFinancials: [
            {
              financial_year: 2024,
              dates: { pldd: "2024-12-31", bsdd: null },
              account: {
                turnover: 999,
                plnpat: 1,
                networth: 1,
                totass: 1,
                totlib: 1,
                bsqpuc: 1,
                return_on_equity: 99,
              },
            },
          ],
        })
      );

      const fy2024 = published.financialComparisonSource.years.find((y) => y.year === 2024);
      expect(fy2024?.rawFinancials.totass).toBe(700);
      expect(fy2024?.rawFinancials.totlib).toBe(200);
      expect(fy2024?.rawFinancials.networth).toBeNull();
      expect(published.financialComparisonMetrics.rows.find((r) => r.key === "roe")?.values[2]).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );
    });

    it("creates a valid empty Page 2 snapshot when financials are missing", () => {
      const page2 = buildProspectusPage2Snapshot({ financialStatements: null });
      expect(page2.financial_comparison.selected_years).toEqual([]);
      expect(page2.financial_comparison.calculated_at).toBeTruthy();
    });

    it("merges page_2 without overwriting page_1 or unknown branches", () => {
      const page2 = buildProspectusPage2Snapshot({ financialStatements: null });
      const merged = wrapProspectusSnapshotWithPageTwo(frozenPage1, page2, {
        page_1: { should_be_replaced: true },
        page_2: { old: true },
        future_branch: { keep: true },
      });

      expect(merged.page_1).toEqual(frozenPage1);
      expect(merged.page_2).toEqual(page2);
      expect((merged as Record<string, unknown>).future_branch).toEqual({ keep: true });
    });
  });

  describe("published vs unpublished Stage 4", () => {
    it("uses frozen Stage 4 for published Notes and ignores live Application data", () => {
      const frozen = buildProspectusPage2Snapshot({
        financialStatements: {
          questionnaire: { financial_year_end: "2027-12-31" },
          unaudited_by_year: {},
        },
        ctosFinancials: [
          { financial_year: 2022, dates: { pldd: "2022-12-31", bsdd: null }, account: { turnover: 12_000_000, plnpat: 900_000, bsqpuc: 5_000_000, bscatot: 4_000_000, curlib: 2_000_000 } },
          { financial_year: 2023, dates: { pldd: "2023-12-31", bsdd: null }, account: { turnover: 13_900_000, plnpat: 1_100_000, bsqpuc: 5_500_000, bscatot: 4_200_000, curlib: 2_100_000 } },
          { financial_year: 2024, dates: { pldd: "2024-12-31", bsdd: null }, account: { turnover: 15_000_000, plnpat: 1_200_000, bsqpuc: 6_000_000, bscatot: 4_500_000, curlib: 2_200_000 } },
        ],
      }).financial_comparison;
      // Mutate "live" data to prove it is ignored
      const changedLive = {
        ...liveFinancialStatements,
        unaudited_by_year: {
          "2024": { turnover: 999, plnpat: 1, bsqpuc: 1, bscatot: 1, curlib: 1 },
        },
      };

      const data: ProspectusPageTwoLoadedData = {
        note: baseNote({
          status: NoteStatus.PUBLISHED,
          published_at: new Date("2026-07-01T00:00:00.000Z"),
          prospectus_snapshot: {
            page_1: frozenPage1,
            page_2: { financial_comparison: frozen },
          },
        }),
        liveFinancialStatements: changedLive,
        liveCtosFinancials,
      };

      const input = mapProspectusPageTwoDataToInput(data);
      expect(input.financialMode).toBe("frozen_publication_snapshot");
      expect(input.liveFinancialStatements).toBeNull();

      const page = buildProspectusPageTwo(input);
      expect(page.financialComparisonSource.years.map((y) => y.year)).toEqual([
        2022, 2023, 2024,
      ]);
      const revenue = page.financialComparisonMetrics.rows.find((r) => r.key === "revenue");
      expect(revenue?.values[2]).toBe("15");
      expect(revenue?.values[2]).not.toBe("0.000999");
    });

    it("does not live-fallback when published page_2 is missing or malformed", () => {
      for (const snapshot of [
        { page_1: frozenPage1 },
        { page_1: frozenPage1, page_2: { financial_comparison: { broken: true } } },
        { page_1: frozenPage1, page_2: null },
      ]) {
        const input = mapProspectusPageTwoDataToInput({
          note: baseNote({
            status: NoteStatus.PUBLISHED,
            published_at: new Date(),
            prospectus_snapshot: snapshot,
          }),
          liveFinancialStatements,
          liveCtosFinancials,
        });
        expect(input.financialMode).toBe("published_unavailable");
        expect(input.liveFinancialStatements).toBeNull();
        const page = buildProspectusPageTwo(input);
        expect(page.financialComparisonSource.years).toEqual([]);
      }
    });

    it("uses live Application financials for unpublished preview", () => {
      const input = mapProspectusPageTwoDataToInput({
        note: baseNote({ status: NoteStatus.DRAFT, published_at: null }),
        liveFinancialStatements,
        liveCtosFinancials,
      });
      expect(input.financialMode).toBe("live_unpublished_preview");
      const page = buildProspectusPageTwo(input);
      expect(page.financialComparisonSource.years.map((y) => y.year)).toEqual([
        2022, 2023, 2024,
      ]);
      expect(
        page.financialComparisonMetrics.rows.find((r) => r.key === "revenue")?.values[0]
      ).toBe("12");
    });

    it("yields empty Stage 4 when unpublished Application financials are missing", () => {
      const page = buildProspectusPageTwo(
        mapProspectusPageTwoDataToInput({
          note: baseNote(),
          liveFinancialStatements: null,
          liveCtosFinancials: null,
        })
      );
      expect(page.financialComparisonSource.years).toEqual([]);
      expect(page.issuerProfile).not.toHaveProperty("companyName");
      expect(page.issuerProfile.industry).toBe("Construction");
    });
  });

  describe("stage mapping", () => {
    it("maps Stage 1–8 from snapshots and DNA builders", () => {
      const page = buildProspectusPageTwo(
        mapProspectusPageTwoDataToInput({
          note: baseNote(),
          liveFinancialStatements,
          liveCtosFinancials,
        })
      );

      expect(page.issuerProfile).not.toHaveProperty("companyName");
      expect(page.issuerProfile).not.toHaveProperty("registrationNumber");
      expect(page.issuerProfile).not.toHaveProperty("entityType");
      expect(page.issuerProfile.industry).toBe("Construction");
      expect(page.issuerProfile.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.issuerProfile.industry).toBe("Construction");
      expect(page.issuerProfile).not.toHaveProperty("industryAndCompanySize");
      expect(page.issuerProfile.registeredCountry).toBe("Registered in Malaysia");
      expect(page.issuerProfile.businessDescription).toBe("Infrastructure works");

      const withOfficerSize = buildProspectusPageTwo({
        ...mapProspectusPageTwoDataToInput({
          note: baseNote(),
          liveFinancialStatements,
          liveCtosFinancials,
        }),
        publicationContent: {
          ...PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT,
          issuerProfile: { companySize: "Medium" },
        },
      });
      expect(withOfficerSize.issuerProfile.industry).toBe("Construction");
      expect(withOfficerSize.issuerProfile.companySize).toBe("Medium");
      const pageHtml = renderProspectusPageTwoHtml(withOfficerSize);
      expect(pageHtml).toContain('class="issuer-meta-line"');
      expect(pageHtml).toContain("Construction | Medium");
      expect(pageHtml).not.toContain("<strong>Industry</strong>");
      expect(pageHtml).not.toContain("<strong>Company Size</strong>");

      expect(page.invoicePaymaster.invoiceAmount).toBe(formatProspectusMoneyMyr(625_000));
      expect(page.invoicePaymaster.deedOfAssignment).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.invoicePaymaster.paymasterRating).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.invoicePaymaster.confidenceGrading).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

      const withOfficerInvoice = buildProspectusPageTwo({
        ...mapProspectusPageTwoDataToInput({
          note: baseNote(),
          liveFinancialStatements,
          liveCtosFinancials,
        }),
        publicationContent: {
          ...PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT,
          invoicePaymaster: {
            deedOfAssignment: "Yes",
            paymasterRating: "PM1",
            confidenceGrading: "High",
          },
        },
      });
      expect(withOfficerInvoice.invoicePaymaster.deedOfAssignment).toBe("Yes");
      expect(withOfficerInvoice.invoicePaymaster.paymasterRating).toBe("PM1");
      expect(withOfficerInvoice.invoicePaymaster.confidenceGrading).toBe("High");

      const invoiceHtml = renderProspectusPageTwoHtml(withOfficerInvoice);
      expect(invoiceHtml).toContain("Nature of Paymaster");
      expect(invoiceHtml).toContain("Deed of Assignment (DOA)");
      expect(invoiceHtml).not.toContain("Nature of Paymaster:");
      expect(invoiceHtml).not.toContain("Deed of Assignment (DOA):");
      expect(invoiceHtml).toContain("Yes");
      expect(invoiceHtml).not.toContain("Paymaster Rating");
      expect(invoiceHtml).not.toContain("Confidence Grading");
      expect(invoiceHtml).not.toContain("PM1");
      expect(invoiceHtml).not.toContain(">High<");
      expect(invoiceHtml).not.toContain("financing ratio");
      expect(invoiceHtml).not.toContain("INV-");

      expect(page.paymasterTrackRecord.totalInvoicesPaid).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.paymasterTrackRecord.totalAmountPaid).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

      const withOfficerTrack = buildProspectusPageTwo({
        ...mapProspectusPageTwoDataToInput({
          note: baseNote(),
          liveFinancialStatements,
          liveCtosFinancials,
        }),
        publicationContent: {
          ...PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT,
          paymasterTrackRecord: {
            totalInvoicesPaid: 48,
            totalAmountPaid: "12500000",
            successfulRepaymentPercent: 98.5,
            onTimePaymentPercent: 94,
            averagePaymentPeriodDays: 32,
          },
        },
      });
      expect(withOfficerTrack.paymasterTrackRecord.totalInvoicesPaid).toBe("48");
      expect(withOfficerTrack.paymasterTrackRecord.totalAmountPaid).toBe("RM 12,500,000.00");
      expect(withOfficerTrack.paymasterTrackRecord.successfulRepaymentPercent).toBe("98.5%");
      expect(withOfficerTrack.paymasterTrackRecord.onTimePayment).toBe("94%");
      expect(withOfficerTrack.paymasterTrackRecord.averagePaymentPeriod).toBe("32 days");
      const trackHtml = renderProspectusPageTwoHtml(withOfficerTrack);
      expect(trackHtml).toContain("Successful Repayment");
      expect(trackHtml).toContain("On-Time Payment");
      expect(trackHtml).not.toContain("Successful Repayment:");
      expect(trackHtml).not.toContain("On-Time Payment:");
      expect(trackHtml).toContain("32 days");


      const unsupported = ["netDebtEquity", "interestCoverage", "dscr", "receivablesDays"];
      for (const key of unsupported) {
        const row = page.financialComparisonMetrics.rows.find((r) => r.key === key);
        expect(row?.values.every((v) => v === PROSPECTUS_DATA_NOT_AVAILABLE)).toBe(true);
      }

      const withFinOverrides = buildProspectusPageTwo({
        ...mapProspectusPageTwoDataToInput({
          note: baseNote(),
          liveFinancialStatements,
          liveCtosFinancials,
        }),
        publicationContent: {
          ...PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT,
          financialComparison: {
            overrides: {
              "2024-12-31": {
                netDebtEquity: 0.5,
                interestCoverage: 4,
                dscr: 1.2,
                receivablesDays: 30,
              },
            },
          },
        },
      });
      const nde = withFinOverrides.financialComparisonMetrics.rows.find(
        (r) => r.key === "netDebtEquity"
      );
      const yearIdx = withFinOverrides.financialComparisonMetrics.years.findIndex(
        (y) => y.year === 2024
      );
      expect(yearIdx).toBeGreaterThanOrEqual(0);
      expect(nde?.values[yearIdx]).toBe("0.5x");
      expect(
        withFinOverrides.financialComparisonMetrics.rows.find((r) => r.key === "receivablesDays")
          ?.values[yearIdx]
      ).toBe("30");

      expect(page.creditInsights.creditScore).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.invoiceWorkNarrative.workUnderContractStatement).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );

      const selected = page.soukscoreRatingScale.grades.filter((g) => g.isSelected);
      expect(selected).toHaveLength(1);
      expect(selected[0]?.grade).toBe("B");
      expect(page.soukscoreRatingScale.selectedGrade).toBe("B");
      expect(page.soukscoreRatingScale.missingRatingMessage).toBeNull();
      expect(page.soukscoreRatingScale).not.toHaveProperty("assessmentNote");
      expect(page.soukscoreRatingScale.grades[0]).not.toHaveProperty("riskLabel");
      expect(page.soukscoreRatingScale.grades[0]).not.toHaveProperty("definition");


      expect(page.investmentCta.minimumInvestmentStatement).toContain(
        formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR)
      );
      expect(page.header.tagline).toBe("Invest in Growth. Earn with Purpose.");
      expect(page).not.toHaveProperty("footer");
    });

    it("selects no SoukScore grade for invalid ratings", () => {
      for (const rating of ["A-", "AAA", "AA", "BBB", "AA+", "90%"]) {
        const page = buildProspectusPageTwo(
          mapProspectusPageTwoDataToInput({
            note: baseNote({
              invoice_snapshot: {
                details: { value: 100 },
                offer_details: { risk_rating: rating },
              },
            }),
            liveFinancialStatements,
          liveCtosFinancials,
          })
        );
        expect(page.soukscoreRatingScale.grades.every((g) => !g.isSelected)).toBe(true);
        expect(page.soukscoreRatingScale.selectedGrade).toBeNull();
        expect(page.soukscoreRatingScale.missingRatingMessage).toBe("—");
      }
    });

    it("uses frozen Note invoice_snapshot risk_rating and ignores a different live invoice value", () => {
      const frozenNote = baseNote({
        invoice_snapshot: {
          details: { value: 100 },
          offer_details: { risk_rating: "C" },
        },
      });
      const page = buildProspectusPageTwo(
        mapProspectusPageTwoDataToInput({
          note: frozenNote,
          liveFinancialStatements,
          liveCtosFinancials,
        })
      );
      expect(page.soukscoreRatingScale.selectedGrade).toBe("C");

      const liveInvoiceWouldBe = { offer_details: { risk_rating: "A" } };
      expect(liveInvoiceWouldBe.offer_details.risk_rating).toBe("A");
      expect(
        (frozenNote.invoice_snapshot as { offer_details: { risk_rating: string } }).offer_details
          .risk_rating
      ).toBe("C");
      expect(page.soukscoreRatingScale.selectedGrade).not.toBe(
        liveInvoiceWouldBe.offer_details.risk_rating
      );

      const html = renderProspectusPageTwoHtml(page);
      const stage7Start = html.indexOf('data-stage="7"');
      const stage8Start = html.indexOf('data-stage="8-cta"');
      expect(stage7Start).toBeGreaterThan(-1);
      expect(stage8Start).toBeGreaterThan(stage7Start);
      const stage7 = html.slice(stage7Start, stage8Start);
      expect(stage7).toContain("SME-1 - SME-2");
      expect(stage7).toContain("data-marc-scale-version");
      expect(stage7).not.toContain('data-grade="C"');
      expect(stage7).not.toContain("data-selected");
      expect(stage7).not.toContain("is-selected");
      expect(stage7).toContain("Risk Rating Scale");
      expect(stage7).not.toContain("Cashsouk Risk Rating");
      expect(stage7).not.toContain("Assessment Note");
      expect(stage7).not.toContain("Risk Label");
      expect(stage7).not.toContain("Definition:");
      expect(stage7).not.toContain("creditScore");
      expect(stage7).not.toContain("CTOS");
      expect(page.soukscoreRatingScale.audit.scale.creditInsightsDerived).toBe(false);
    });

    it("keeps Company Size DNA when old issuer snapshot keys are missing", () => {
      const page = buildProspectusPageTwo(
        mapProspectusPageTwoDataToInput({
          note: baseNote({
            issuer_snapshot: { name: "Old Issuer" },
          }),
          liveFinancialStatements,
          liveCtosFinancials,
        })
      );
      expect(page.issuerProfile).not.toHaveProperty("companyName");
      expect(page.issuerProfile).not.toHaveProperty("registrationNumber");
      expect(page.issuerProfile).not.toHaveProperty("entityType");
      expect(page.issuerProfile.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.issuerProfile.industry).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.issuerProfile).not.toHaveProperty("industryAndCompanySize");
    });
  });

  describe("static Investment CTA", () => {
    it("keeps the same static CTA regardless of funded amount or remaining capacity", () => {
      const open = buildProspectusPageTwo(
        mapProspectusPageTwoDataToInput({
          note: baseNote({ target_amount: 500_000, funded_amount: 0 }),
          liveFinancialStatements,
          liveCtosFinancials,
        })
      );
      const closed = buildProspectusPageTwo(
        mapProspectusPageTwoDataToInput({
          note: baseNote({ target_amount: 500_000, funded_amount: 500_000 }),
          liveFinancialStatements,
          liveCtosFinancials,
        })
      );

      expect(open.investmentCta).toEqual(closed.investmentCta);
      expect(open.investmentCta.sectionHeading).toBe("INVEST WITH CONFIDENCE");
      expect(open.investmentCta.buttonLabel).toBe("INVEST NOW");
      expect(open.investmentCta.buttonHref).toBeNull();
      expect(open.investmentCta.minimumInvestmentStatement).toBe(
        `Minimum investment: ${formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR)}`
      );
      expect(open.investmentCta).not.toHaveProperty("isButtonEnabled");
      expect(open.investmentCta.audit.liveInvestabilityUsed).toBe(false);
      expect(open.investmentCta.audit.routeInFrozenHtmlAllowed).toBe(false);

      const html = renderProspectusPageTwoHtml(open);
      const stageCta = html.slice(html.indexOf('data-stage="8-cta"'));
      expect(stageCta).toContain("INVEST WITH CONFIDENCE");
      expect(stageCta).toContain(PROSPECTUS_INVEST_CTA_DESCRIPTION);
      expect(stageCta).toContain("INVEST NOW");
      expect(stageCta).toContain("Minimum investment: RM 100.00");
      expect(stageCta).toContain('<div class="cta-button" aria-hidden="true">INVEST NOW</div>');
      expect(stageCta).not.toContain("<button");
      expect(stageCta).not.toContain("disabled");
      expect(stageCta).not.toContain("CTA Paragraph");
      expect(stageCta).not.toContain("/investments/");
      expect(stageCta).not.toContain("<a ");
      const descIdx = stageCta.indexOf(PROSPECTUS_INVEST_CTA_DESCRIPTION);
      const buttonIdx = stageCta.indexOf("INVEST NOW");
      const minIdx = stageCta.indexOf("Minimum investment:");
      expect(descIdx).toBeGreaterThan(-1);
      expect(buttonIdx).toBeGreaterThan(descIdx);
      expect(minIdx).toBeGreaterThan(buttonIdx);
    });
  });

  describe("money and assembly HTML", () => {
    it("uses full MYR, A4 dimensions, and correct section order", () => {
      const page = SAMPLE_PROSPECTUS_PAGE_TWO;
      const html = renderProspectusPageTwoHtml(page);

      expect(PROSPECTUS_PAGE_TWO_WIDTH_MM).toBe(210);
      expect(PROSPECTUS_PAGE_TWO_HEIGHT_MM).toBe(297);
      expect(html).toContain("210mm");
      expect(html).toContain("297mm");
      expect(html).toContain('data-page="prospectus-page-two"');
      expect((html.match(/data-page="prospectus-page-two"/g) ?? []).length).toBe(1);

      expect(page.invoicePaymaster.invoiceAmount).toBe("RM 625,000.00");
      expect(html).toContain("RM 625,000.00");
      expect(html).toContain("15");
      expect(html).toContain("(MYR mil.)");
      expect(html).toContain("RM 100.00");
      expect(html).not.toMatch(/\b625k\b/);
      expect(html).not.toContain("RM 15,000,000");
      expect(html).not.toContain("RM 100</");

      const headerIdx = html.indexOf('data-stage="header"');
      const s1 = html.indexOf('data-stage="1"');
      const s2 = html.indexOf('data-stage="2"');
      const s3 = html.indexOf('data-stage="3"');
      const s4 = html.indexOf('data-stage="4"');
      const s5 = html.indexOf('data-stage="5"');
      const s6 = html.indexOf('data-stage="6"');
      const s7 = html.indexOf('data-stage="7"');
      const cta = html.indexOf('data-stage="8-cta"');
      expect(headerIdx).toBeGreaterThan(-1);
      expect(s1).toBeGreaterThan(headerIdx);
      expect(s2).toBeGreaterThan(s1);
      expect(s3).toBeGreaterThan(s2);
      expect(s4).toBeGreaterThan(s3);
      expect(s5).toBeGreaterThan(s4);
      expect(s6).toBeGreaterThan(s5);
      expect(s7).toBeGreaterThan(s6);
      expect(cta).toBeGreaterThan(s7);
      expect(html.indexOf('data-stage="footer"')).toBeGreaterThan(cta);
      expect(html).not.toContain("Source Note:");
      expect(html).toContain("prospectus-footer");
      expect(html).toContain("Product Terms and Risk Disclosure Statement");
      expect(html).toContain("Investments are subject to credit risk");
      expect(html).not.toContain("Investment are subjects");
      expect(html.lastIndexOf('data-stage="footer"')).toBeGreaterThan(cta);

      expect(html).not.toContain('data-stage="4a"');
      expect(html).not.toContain("canonicalSystem");
      expect(html).not.toContain("snapshotDecision");
      expect(html).not.toContain("applications.financial_statements");
      expect(html).not.toContain('"audit"');
      expect(html).not.toContain("CTOS");
      expect(html).not.toContain('href="#"');
      expect(html).not.toContain("javascript:");
      expect(html).not.toContain(`Note ID: ${page.meta.noteId}`);
      expect(html).not.toContain(`href="/investments/${page.meta.noteId}"`);
      expect(html).toContain("INVEST NOW");
      expect(html).toContain("INVEST WITH CONFIDENCE");
      expect(html).toContain(PROSPECTUS_INVEST_CTA_DESCRIPTION);
      expect(html).toContain("Minimum investment: RM 100.00");
      expect(html).toContain('<div class="cta-button" aria-hidden="true">INVEST NOW</div>');
      expect(html).not.toContain("<button");
      expect(html).not.toContain("disabled");
      expect(html.match(/class="risk-scale-note"/g)?.length).toBe(1);
      expect(html.match(/class="invest-confidence-description"/g)?.length).toBe(1);
      expect(html).toContain(PROSPECTUS_RISK_SCALE_NOTE);
      const scaleIdx = html.indexOf('data-stage="7"');
      const noteIdx = html.indexOf('class="risk-scale-note"');
      const gradeBandIdx = html.indexOf('data-grade="SME-1 - SME-2"');
      expect(noteIdx).toBeGreaterThan(gradeBandIdx);
      expect(noteIdx).toBeGreaterThan(scaleIdx);
      expect(html).toContain("page-two-financial-card");
      expect(html).toContain("page-two-insights-card");
      expect(html).toContain('class="soukscore-scale marc-sme-scale"');
      expect(html).toContain("SME-1–2");
      expect(html).toContain("Extremely strong credit strength with very low non-repayment risk");
      expect(html).toContain("Very weak credit strength with high potential to default");
      expect(html).not.toContain("minimal repayment risk");
      expect(html).not.toContain("ellipsis");
      for (const band of ["SME-1 - SME-2", "SME-3 - SME-4", "SME-5 - SME-6", "SME-7 - SME-8", "SME-9 - SME-10"]) {
        expect(html).toContain(`data-grade="${band}"`);
      }
    });

    it("reconstructs frozen Stage 4A without live year reselection", () => {
      const frozen = buildProspectusPage2Snapshot({
        financialStatements: {
          questionnaire: { financial_year_end: "2027-12-31" },
          unaudited_by_year: {},
        },
        ctosFinancials: [
          { financial_year: 2022, dates: { pldd: "2022-12-31", bsdd: null }, account: { turnover: 12_000_000, plnpat: 900_000, bsqpuc: 5_000_000, bscatot: 4_000_000, curlib: 2_000_000 } },
          { financial_year: 2023, dates: { pldd: "2023-12-31", bsdd: null }, account: { turnover: 13_900_000, plnpat: 1_100_000, bsqpuc: 5_500_000, bscatot: 4_200_000, curlib: 2_100_000 } },
          { financial_year: 2024, dates: { pldd: "2024-12-31", bsdd: null }, account: { turnover: 15_000_000, plnpat: 1_200_000, bsqpuc: 6_000_000, bscatot: 4_500_000, curlib: 2_200_000 } },
        ],
      }).financial_comparison;
      const source = buildFinancialComparisonSourceFromFrozen(frozen);
      expect(source.years.map((y) => y.yearLabel)).toEqual(["FY2022", "FY2023", "FY2024"]);
      expect(parseProspectusPageTwoSnapshot({ page_2: { financial_comparison: frozen } })).not.toBeNull();
    });
  });

  describe("loader not-found", () => {
    it("throws NOTE_NOT_FOUND for missing Notes", async () => {
      const db = {
        note: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        application: {
          findUnique: jest.fn(),
        },
      };
      await expect(loadProspectusPageTwoData(db as never, "missing")).rejects.toBeInstanceOf(
        AppError
      );
      try {
        await loadProspectusPageTwoData(db as never, "missing");
      } catch (error) {
        expect(error).toMatchObject({ statusCode: 404, code: "NOTE_NOT_FOUND" });
      }
      expect(db.application.findUnique).not.toHaveBeenCalled();
    });

    it("does not load Application financials for published Notes", async () => {
      const db = {
        note: {
          findUnique: jest.fn().mockResolvedValue(
            baseNote({
              status: NoteStatus.PUBLISHED,
              published_at: new Date(),
            })
          ),
        },
        application: {
          findUnique: jest.fn(),
        },
        ctosReport: {
          findFirst: jest.fn(),
        },
      };
      const loaded = await loadProspectusPageTwoData(db as never, "n1");
      expect(loaded.liveFinancialStatements).toBeNull();
      expect(loaded.liveCtosFinancials).toBeNull();
      expect(db.application.findUnique).not.toHaveBeenCalled();
      expect(db.ctosReport.findFirst).not.toHaveBeenCalled();
    });
  });

  it("does not wire live investability or routes into the Page 2 mapper", () => {
    const source = readFileSync(join(__dirname, "prospectus-page-two-mapper.ts"), "utf8");
    expect(source).toContain("buildProspectusInvestmentCta()");
    expect(source).not.toContain("computeMarketplaceCommitBounds");
    expect(source).not.toContain("buildProspectusInvestorNoteInvestmentPath");
    expect(source).not.toMatch(/formatProspectusMoneyMyr\(\s*100\s*\)/);
  });
});
