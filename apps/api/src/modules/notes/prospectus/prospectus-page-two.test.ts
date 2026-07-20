import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NoteStatus } from "@prisma/client";
import { computeMarketplaceCommitBounds, MARKETPLACE_MIN_COMMIT_MYR } from "@cashsouk/types";
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
      offer_details: { risk_rating: "AA" },
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
  questionnaire: { financial_year_end: "2024-12-31" },
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
      expect(JSON.stringify(PROSPECTUS_PAGE_TWO_NOTE_SELECT)).not.toContain("organization");
    });
  });

  describe("publication snapshot freeze", () => {
    it("freezes Stage 4 years and raw values without formatted money or CTOS", () => {
      const page2 = buildProspectusPage2Snapshot({
        financialStatements: liveFinancialStatements,
        now: new Date("2026-07-19T12:00:00.000Z"),
      });

      expect(page2.financial_comparison.source).toBe("application_financial_statements");
      expect(page2.financial_comparison.selected_years.map((y) => y.year)).toEqual([
        2022, 2023, 2024,
      ]);
      expect(page2.financial_comparison.selected_years[2]?.raw_financials.turnover).toBe(
        15_000_000
      );
      expect(page2.financial_comparison.calculated_at).toBe("2026-07-19T12:00:00.000Z");

      const serialized = JSON.stringify(page2);
      expect(serialized).not.toMatch(/RM /);
      expect(serialized).not.toMatch(/CTOS|CCRIS|RegTank/i);
      expect(serialized).not.toMatch(/attractive return|Shariah-compliant/i);
    });

    it("extends shared freeze with Page 3 raw keys and preserves zeros", () => {
      const page2 = buildProspectusPage2Snapshot({
        financialStatements: {
          questionnaire: { financial_year_end: "2024-12-31" },
          unaudited_by_year: {
            "2024": {
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
            },
          },
        },
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
        financialStatements: liveFinancialStatements,
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
      };

      const input = mapProspectusPageTwoDataToInput(data);
      expect(input.financialMode).toBe("frozen_publication_snapshot");
      expect(input.liveFinancialStatements).toBeNull();

      const page = buildProspectusPageTwo(input);
      expect(page.financialComparisonSource.years.map((y) => y.year)).toEqual([
        2022, 2023, 2024,
      ]);
      const revenue = page.financialComparisonMetrics.rows.find((r) => r.key === "revenue");
      expect(revenue?.values[2]).toBe(formatProspectusMoneyMyr(15_000_000));
      expect(revenue?.values[2]).not.toBe(formatProspectusMoneyMyr(999));
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
          liveFinancialStatements: liveFinancialStatements,
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
      });
      expect(input.financialMode).toBe("live_unpublished_preview");
      const page = buildProspectusPageTwo(input);
      expect(page.financialComparisonSource.years.map((y) => y.year)).toEqual([
        2022, 2023, 2024,
      ]);
      expect(
        page.financialComparisonMetrics.rows.find((r) => r.key === "revenue")?.values[0]
      ).toBe(formatProspectusMoneyMyr(12_000_000));
    });

    it("yields empty Stage 4 when unpublished Application financials are missing", () => {
      const page = buildProspectusPageTwo(
        mapProspectusPageTwoDataToInput({
          note: baseNote(),
          liveFinancialStatements: null,
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
        })
      );

      expect(page.issuerProfile).not.toHaveProperty("companyName");
      expect(page.issuerProfile).not.toHaveProperty("registrationNumber");
      expect(page.issuerProfile).not.toHaveProperty("entityType");
      expect(page.issuerProfile.industry).toBe("Construction");
      expect(page.issuerProfile.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.issuerProfile.industryAndCompanySize).toBe("Construction");
      expect(page.issuerProfile.registeredCountry).toBe("Registered in Malaysia");
      expect(page.issuerProfile.businessDescription).toBe("Infrastructure works");

      expect(page.invoicePaymaster.invoiceAmount).toBe(formatProspectusMoneyMyr(625_000));
      expect(page.invoicePaymaster.deedOfAssignment).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.invoicePaymaster.paymasterRating).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.invoicePaymaster.confidenceGrading).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

      expect(page.paymasterTrackRecord.totalInvoicesPaid).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.paymasterTrackRecord.totalAmountPaid).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

      const unsupported = ["netDebtEquity", "interestCoverage", "dscr", "receivablesDays"];
      for (const key of unsupported) {
        const row = page.financialComparisonMetrics.rows.find((r) => r.key === key);
        expect(row?.values.every((v) => v === PROSPECTUS_DATA_NOT_AVAILABLE)).toBe(true);
      }

      expect(page.creditInsights.creditScore).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.invoiceWorkNarrative.workUnderContractStatement).toBe(
        PROSPECTUS_DATA_NOT_AVAILABLE
      );

      const selected = page.soukscoreRatingScale.grades.filter((g) => g.isSelected);
      expect(selected).toHaveLength(1);
      expect(selected[0]?.grade).toBe("AA");
      expect(page.soukscoreRatingScale.grades.every((g) => g.riskLabel === PROSPECTUS_DATA_NOT_AVAILABLE)).toBe(
        true
      );

      expect(page.investmentCta.minimumInvestmentStatement).toContain(
        formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR)
      );
      expect(page.header.tagline).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page).not.toHaveProperty("footer");
    });

    it("selects no SoukScore grade for invalid ratings", () => {
      for (const rating of ["A-", "C", "D", "E", "AA+"]) {
        const page = buildProspectusPageTwo(
          mapProspectusPageTwoDataToInput({
            note: baseNote({
              invoice_snapshot: {
                details: { value: 100 },
                offer_details: { risk_rating: rating },
              },
            }),
            liveFinancialStatements: null,
          })
        );
        expect(page.soukscoreRatingScale.grades.every((g) => !g.isSelected)).toBe(true);
      }
    });

    it("keeps Company Size DNA when old issuer snapshot keys are missing", () => {
      const page = buildProspectusPageTwo(
        mapProspectusPageTwoDataToInput({
          note: baseNote({
            issuer_snapshot: { name: "Old Issuer" },
          }),
          liveFinancialStatements: null,
        })
      );
      expect(page.issuerProfile).not.toHaveProperty("companyName");
      expect(page.issuerProfile).not.toHaveProperty("registrationNumber");
      expect(page.issuerProfile).not.toHaveProperty("entityType");
      expect(page.issuerProfile.companySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.issuerProfile.industry).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
      expect(page.issuerProfile.industryAndCompanySize).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    });
  });

  describe("investability and CTA", () => {
    it("reuses computeMarketplaceCommitBounds for enabled vs disabled CTA", () => {
      const investable = computeMarketplaceCommitBounds(500_000, 0).investable;
      expect(investable).toBe(true);
      const open = buildProspectusPageTwo(
        mapProspectusPageTwoDataToInput({
          note: baseNote({ target_amount: 500_000, funded_amount: 0 }),
          liveFinancialStatements: null,
        })
      );
      expect(open.investmentCta.isButtonEnabled).toBe(true);
      expect(open.investmentCta.buttonHref).toBe("/investments/clsamplepage2note0001");

      const closed = buildProspectusPageTwo(
        mapProspectusPageTwoDataToInput({
          note: baseNote({ target_amount: 500_000, funded_amount: 500_000 }),
          liveFinancialStatements: null,
        })
      );
      expect(computeMarketplaceCommitBounds(500_000, 500_000).investable).toBe(false);
      expect(closed.investmentCta.isButtonEnabled).toBe(false);
      expect(closed.investmentCta.buttonHref).toBeNull();
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
      expect(html).toContain("RM 15,000,000.00");
      expect(html).toContain("RM 100.00");
      expect(html).not.toMatch(/\bmil\b|\bmillion\b|\b625k\b|\(MYR mil\.\)/i);
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
      expect(html.indexOf('data-stage="footer"')).toBe(-1);
      expect(html).not.toContain("Source Note:");
      expect(html).not.toContain("Investment Risk Warning");
      expect(html).not.toContain("Product Terms / Risk Disclosure Statement");
      expect(html).not.toContain("prospectus-footer");
      expect(html.lastIndexOf("data-stage=")).toBe(cta);

      expect(html).not.toContain('data-stage="4a"');
      expect(html).not.toContain("canonicalSystem");
      expect(html).not.toContain("snapshotDecision");
      expect(html).not.toContain("applications.financial_statements");
      expect(html).not.toContain('"audit"');
      expect(html).not.toContain("CTOS");
      expect(html).not.toContain("attractive return");
      expect(html).not.toContain('href="#"');
      expect(html).not.toContain("javascript:");
      expect(html).not.toContain(`Note ID: ${page.meta.noteId}`);
      expect(html).toContain(`href="/investments/${page.meta.noteId}"`);
    });

    it("reconstructs frozen Stage 4A without live year reselection", () => {
      const frozen = buildProspectusPage2Snapshot({
        financialStatements: liveFinancialStatements,
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
      };
      const loaded = await loadProspectusPageTwoData(db as never, "n1");
      expect(loaded.liveFinancialStatements).toBeNull();
      expect(db.application.findUnique).not.toHaveBeenCalled();
    });
  });

  it("does not hardcode minimum investment amount in the mapper", () => {
    const source = readFileSync(join(__dirname, "prospectus-page-two-mapper.ts"), "utf8");
    expect(source).toContain("computeMarketplaceCommitBounds");
    expect(source).not.toMatch(/formatProspectusMoneyMyr\(\s*100\s*\)/);
  });
});
