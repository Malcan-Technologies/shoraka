import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NoteStatus } from "@prisma/client";
import {
  MARKETPLACE_MIN_COMMIT_MYR,
  PROSPECTUS_FIXED_PAYMENT_BASIS,
  PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
} from "@cashsouk/types";
import { AppError } from "../../../lib/http/error-handler";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import { PROSPECTUS_HISTORICAL_NOTE_EMPTY_STATE } from "./prospectus-historical-note-table.types";
import {
  buildProspectusPageOne,
  mapProspectusPageOneDataToInput,
  mapProspectusPageOneFromNote,
  type ProspectusPageOneBuilderInput,
} from "./prospectus-page-one-mapper";
import {
  isProspectusNotePublished,
  loadProspectusPageOneNote,
  PROSPECTUS_PAGE_ONE_NOTE_SELECT,
  type ProspectusPageOneNoteRecord,
} from "./prospectus-page-one-prisma";
import { SAMPLE_PROSPECTUS_PAGE_ONE, SAMPLE_PROSPECTUS_PAGE_ONE_INPUT } from "./prospectus-page-one.sample-data";
import {
  PROSPECTUS_PAGE_ONE_HEIGHT_MM,
  PROSPECTUS_PAGE_ONE_WIDTH_MM,
} from "./prospectus-page-one.types";
import { renderProspectusPageOneHtml } from "./render-prospectus-page-one";

jest.mock("./prospectus-track-record-query", () => ({
  buildProspectusPage1TrackRecordSnapshot: jest.fn(),
}));

import { buildProspectusPage1TrackRecordSnapshot } from "./prospectus-track-record-query";

const mockLiveSnapshot = buildProspectusPage1TrackRecordSnapshot as jest.MockedFunction<
  typeof buildProspectusPage1TrackRecordSnapshot
>;

function baseNote(
  overrides: Partial<ProspectusPageOneNoteRecord> = {}
): ProspectusPageOneNoteRecord {
  return {
    id: "note-current",
    note_reference: "NOTE-20250515-ABCD1234",
    issuer_organization_id: "org-issuer-1",
    target_amount: 500_000,
    funded_amount: 500_000,
    profit_rate_percent: 12,
    service_fee_rate_percent: 10,
    maturity_date: new Date("2025-09-12T00:00:00.000Z"),
    status: NoteStatus.FUNDING,
    repaid_at: null,
    published_at: null,
    product_snapshot: {
      product_name: "Accounts Receivable Financing-i",
      description: "Frozen product description",
    },
    invoice_snapshot: {
      offer_details: { risk_rating: "AA" },
    },
    paymaster_snapshot: {
      name: "KKR",
      entity_type: "Federal Government Agency",
    },
    purpose_snapshot: {
      financing_for: "Frozen purpose text",
    },
    prospectus_snapshot: null,
    source_application_id: "app-1",
    created_at: new Date("2025-05-01T00:00:00.000Z"),
    updated_at: new Date("2025-05-02T00:00:00.000Z"),
    listing: {
      opens_at: new Date("2025-05-15T00:00:00.000Z"),
      closes_at: new Date("2025-05-22T00:00:00.000Z"),
    },
    ...overrides,
  };
}

const frozenPage1 = {
  issuer_track_record: {
    total_notes_funded: 2,
    total_amount_funded: "3450000",
    successful_repayment_percent: 100,
    on_time_payment_rate_six_months_percent: 90,
    calculated_at: "2025-05-15T00:00:00.000Z",
  },
  historical_notes: [
    {
      note_id: "hist-a",
      note_reference: "NOTE-20240110-AAAA1111",
      financing_type: "Accounts Receivable Financing-i",
      funded_amount: "500000",
      listing_opens_at: "2025-01-10T00:00:00.000Z",
      maturity_date: "2025-05-10T00:00:00.000Z",
      profit_rate_percent: "12",
      status: "REPAID" as const,
      repaid_at: "2025-05-09T00:00:00.000Z",
      updated_at: "2025-05-09T00:00:00.000Z",
    },
    {
      note_id: "hist-b",
      note_reference: "NOTE-20250301-BBBB2222",
      financing_type: "Accounts Receivable Financing-i",
      funded_amount: "100",
      listing_opens_at: "2025-03-01T00:00:00.000Z",
      maturity_date: "2025-06-29T00:00:00.000Z",
      profit_rate_percent: "11",
      status: "ACTIVE" as const,
      repaid_at: null,
      updated_at: "2025-03-20T00:00:00.000Z",
    },
  ],
};

describe("prospectus Page 1 Prisma loader", () => {
  it("loads a current Note by ID with required select", async () => {
    const note = baseNote();
    const findUnique = jest.fn().mockResolvedValue(note);
    const db = { note: { findUnique } } as never;

    const loaded = await loadProspectusPageOneNote(db, "note-current");
    expect(loaded.note_reference).toBe("NOTE-20250515-ABCD1234");
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "note-current" },
      select: PROSPECTUS_PAGE_ONE_NOTE_SELECT,
    });
    expect(PROSPECTUS_PAGE_ONE_NOTE_SELECT).toMatchObject({
      note_reference: true,
      product_snapshot: true,
      purpose_snapshot: true,
      prospectus_snapshot: true,
      listing: { select: { opens_at: true, closes_at: true } },
    });
    expect(PROSPECTUS_PAGE_ONE_NOTE_SELECT).not.toHaveProperty("funding_closed_at");
    expect(PROSPECTUS_PAGE_ONE_NOTE_SELECT).not.toHaveProperty("commitments");
  });

  it("throws NOTE_NOT_FOUND for an unknown Note", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const db = { note: { findUnique } } as never;
    await expect(loadProspectusPageOneNote(db, "missing")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOTE_NOT_FOUND",
    } satisfies Partial<AppError>);
  });
});

describe("prospectus Page 1 publication rule", () => {
  it("treats PUBLISHED with published_at as published", () => {
    expect(
      isProspectusNotePublished({
        status: NoteStatus.PUBLISHED,
        published_at: new Date("2025-05-15T00:00:00.000Z"),
      })
    ).toBe(true);
  });

  it("does not treat FUNDING or missing published_at as published", () => {
    expect(
      isProspectusNotePublished({ status: NoteStatus.FUNDING, published_at: null })
    ).toBe(false);
    expect(
      isProspectusNotePublished({
        status: NoteStatus.PUBLISHED,
        published_at: null,
      })
    ).toBe(false);
  });
});

describe("prospectus Page 1 mapper (Stages 1–6)", () => {
  beforeEach(() => {
    mockLiveSnapshot.mockReset();
  });

  it("maps raw NOTE reference, frozen product description, and never live product", async () => {
    const input = await mapProspectusPageOneDataToInput(
      baseNote({
        product_snapshot: {
          product_name: "Accounts Receivable Financing-i",
          description: "Frozen product description",
        },
      })
    );
    expect(input.noteIdentity.noteReference).toBe("NOTE-20250515-ABCD1234");
    expect(input.noteIdentity.productSnapshotDescription).toBe("Frozen product description");
    expect(input.noteIdentity.liveProductDescription).toBeNull();

    const page = buildProspectusPageOne(input);
    expect(page.noteIdentity.noteReference).toBe("NOTE-20250515-ABCD1234");
    expect(page.noteIdentity.description).toBe("Frozen product description");
  });

  it("maps frozen purpose and never live Application purpose", async () => {
    const input = await mapProspectusPageOneDataToInput(baseNote());
    expect(input.timingPurpose.purposeSnapshotFinancingFor).toBe("Frozen purpose text");
    expect(input.timingPurpose.liveApplicationFinancingFor).toBeNull();
    const page = buildProspectusPageOne(input);
    expect(page.timingPurpose.purposeOfFinancing).toBe("Frozen purpose text");
  });

  it("maps listing opens/closes and does not use funding_closed_at", async () => {
    const input = await mapProspectusPageOneDataToInput(baseNote());
    expect(input.datesPaymaster.listingOpensAt).toEqual(
      new Date("2025-05-15T00:00:00.000Z")
    );
    expect(input.datesPaymaster.listingClosesAt).toEqual(
      new Date("2025-05-22T00:00:00.000Z")
    );
    expect(JSON.stringify(input)).not.toContain("funding_closed_at");
  });

  it("maps paymaster snapshot fields", async () => {
    const page = await mapProspectusPageOneFromNote(baseNote());
    expect(page.datesPaymaster.paymasterName).toBe("KKR");
    expect(page.datesPaymaster.paymasterEntityType).toBe("Federal Government Agency");
    expect(page.paymasterHighlight.paymasterName).toBe("KKR");
  });

  it("maps valid SoukScore with catalogue copy; unavailable for invalid", async () => {
    const valid = await mapProspectusPageOneFromNote(baseNote());
    expect(valid.riskAssessment.canva.riskGrade).toBe("AA");
    expect(valid.riskAssessment.canva.riskLabel).toBe("Low Risk");
    expect(valid.riskAssessment.canva.riskExplanation).toContain("strong financial strength");

    const invalid = await mapProspectusPageOneFromNote(
      baseNote({
        invoice_snapshot: { offer_details: { risk_rating: "A-" } },
      })
    );
    expect(invalid.riskAssessment.canva.riskGrade).toBe("—");
    expect(invalid.riskAssessment.canva.riskLabel).toBe("—");
    expect(invalid.riskAssessment.canva.riskExplanation).toBe("—");
  });

  it("maps target amount, profit rate, and platform minimum", async () => {
    const page = await mapProspectusPageOneFromNote(baseNote());
    expect(page.mainFinancialTerms.financingAmount).toBe("RM 500,000.00");
    expect(page.mainFinancialTerms.profitRate).toBe("12%");
    expect(page.mainFinancialTerms.minimumInvestment).toBe(
      formatProspectusMoneyMyr(MARKETPLACE_MIN_COMMIT_MYR)
    );
    expect(page.mainFinancialTerms.expectedReturnForInvestmentPeriod).toBe("10.8%");
  });

  it("reuses Stage 4A/2 for At a Glance and Stage 4C for Shariah highlight", async () => {
    const page = await mapProspectusPageOneFromNote(baseNote());
    expect(page.atAGlance.financingAmount).toBe(page.mainFinancialTerms.financingAmount);
    expect(page.atAGlance.minimumInvestment).toBe(page.mainFinancialTerms.minimumInvestment);
    expect(page.atAGlance.profitRate).toBe(page.mainFinancialTerms.profitRate);
    expect(page.atAGlance.tenure).toBe(page.datesPaymaster.tenure);
    expect(page.atAGlance.expectedReturn).toBe("10.8%");
    expect(page.atAGlance.expectedReturn).toBe(
      page.mainFinancialTerms.expectedReturnForInvestmentPeriod
    );
    const html = renderProspectusPageOneHtml(page);
    expect(html).toContain("<dt>Expected Return (p.a.)</dt>");
    expect(html).toContain("<small>Expected Return (p.a.)</small>");
    expect(html).not.toContain("Expected Return for investment period");
    expect(html).not.toContain("Expected Returns");
    expect(html).not.toContain("Expected Return per annum");
    expect(page.shariahHighlight.specificShariahPrinciple).toBe(
      page.paymentBasisShariah.shariahPrinciple
    );
    expect(page.paymentBasisShariah.paymentBasis).toBe(PROSPECTUS_FIXED_PAYMENT_BASIS);
    expect(page.paymentBasisShariah.shariahPrinciple).toBe(PROSPECTUS_FIXED_SHARIAH_PRINCIPLE);
    expect(page.shariahHighlight.specificShariahPrinciple).toBe(
      PROSPECTUS_FIXED_SHARIAH_PRINCIPLE
    );
  });

  it("renders DNA for old Notes missing product description and purpose", async () => {
    const page = await mapProspectusPageOneFromNote(
      baseNote({
        product_snapshot: { product_name: "ARF-i" },
        purpose_snapshot: null,
      })
    );
    expect(page.noteIdentity.description).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(page.timingPurpose.purposeOfFinancing).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });
});

describe("prospectus Page 1 Stage 7 snapshot preference", () => {
  beforeEach(() => {
    mockLiveSnapshot.mockReset();
  });

  it("uses frozen Stage 7 for published Notes and does not call live query", async () => {
    const page = await mapProspectusPageOneFromNote(
      baseNote({
        status: NoteStatus.PUBLISHED,
        published_at: new Date("2025-05-15T00:00:00.000Z"),
        prospectus_snapshot: { page_1: frozenPage1 },
      })
    );
    expect(mockLiveSnapshot).not.toHaveBeenCalled();
    expect(page.meta.trackRecordMode).toBe("frozen_publication_snapshot");
    expect(page.issuerTrackRecord.totalNotesFunded).toBe("2");
    expect(page.issuerTrackRecord.totalAmountFunded).toBe("RM 3,450,000.00");
    expect(page.issuerTrackRecord.totalAmountFunded).not.toMatch(/mil|million|\bk\b|K/i);
    expect(page.issuerTrackRecord.audit.snapshot.isFrozen).toBe(true);
  });

  it("uses DNA for missing frozen metric and does not live-recompute on malformed published snapshot", async () => {
    const missingMetric = await mapProspectusPageOneFromNote(
      baseNote({
        status: NoteStatus.PUBLISHED,
        published_at: new Date("2025-05-15T00:00:00.000Z"),
        prospectus_snapshot: {
          page_1: {
            issuer_track_record: {
              total_notes_funded: null,
              total_amount_funded: "1000000",
              successful_repayment_percent: null,
              on_time_payment_rate_six_months_percent: 80,
              calculated_at: "2025-05-15T00:00:00.000Z",
            },
            historical_notes: [],
          },
        },
      })
    );
    expect(missingMetric.issuerTrackRecord.totalNotesFunded).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(missingMetric.issuerTrackRecord.successfulRepayment).toBe(
      PROSPECTUS_DATA_NOT_AVAILABLE
    );
    expect(mockLiveSnapshot).not.toHaveBeenCalled();

    const malformed = await mapProspectusPageOneFromNote(
      baseNote({
        status: NoteStatus.PUBLISHED,
        published_at: new Date("2025-05-15T00:00:00.000Z"),
        prospectus_snapshot: { page_1: { issuer_track_record: { broken: true } } },
      })
    );
    expect(mockLiveSnapshot).not.toHaveBeenCalled();
    expect(malformed.meta.trackRecordMode).toBe("published_unavailable");
    expect(malformed.issuerTrackRecord.totalAmountFunded).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("unpublished preview may use shared live helpers and excludes current Note via query args", async () => {
    mockLiveSnapshot.mockResolvedValue({
      issuer_track_record: {
        total_notes_funded: 1,
        total_amount_funded: "500000",
        successful_repayment_percent: 100,
        on_time_payment_rate_six_months_percent: null,
        calculated_at: "2025-05-15T00:00:00.000Z",
      },
      historical_notes: [],
    });

    const page = await mapProspectusPageOneFromNote(baseNote());
    expect(page.meta.trackRecordMode).toBe("live_unpublished_preview");
    expect(mockLiveSnapshot).toHaveBeenCalledWith({
      issuerOrganizationId: "org-issuer-1",
      currentNoteId: "note-current",
    });
    expect(page.issuerTrackRecord.totalAmountFunded).toBe("RM 500,000.00");
    expect(page.issuerTrackRecord.audit.snapshot.isFrozen).toBe(false);
  });
});

describe("prospectus Page 1 Stage 8 snapshot preference", () => {
  beforeEach(() => {
    mockLiveSnapshot.mockReset();
  });

  it("uses frozen historical rows with order/count preserved and full money formatting", async () => {
    const page = await mapProspectusPageOneFromNote(
      baseNote({
        status: NoteStatus.PUBLISHED,
        published_at: new Date("2025-05-15T00:00:00.000Z"),
        prospectus_snapshot: { page_1: frozenPage1 },
      })
    );
    expect(mockLiveSnapshot).not.toHaveBeenCalled();
    expect(page.historicalNoteTable.rows).toHaveLength(2);
    expect(page.historicalNoteTable.rows[0]?.noteId).toBe("NOTE-20240110-AAAA1111");
    expect(page.historicalNoteTable.rows[1]?.noteId).toBe("NOTE-20250301-BBBB2222");
    expect(page.historicalNoteTable.rows[0]?.amountRm).toBe("RM 500,000.00");
    expect(page.historicalNoteTable.rows[1]?.amountRm).toBe("RM 100.00");
    expect(page.historicalNoteTable.rows[0]?.status).toBe("Repaid");
    expect(page.historicalNoteTable.rows[1]?.status).toBe("Active");
    expect(JSON.stringify(page.historicalNoteTable.rows)).not.toMatch(
      /mil|million|500k|500K/
    );
  });

  it("DNA for missing funded amount / repayment date; empty frozen rows show empty state", async () => {
    const page = await mapProspectusPageOneFromNote(
      baseNote({
        status: NoteStatus.PUBLISHED,
        published_at: new Date("2025-05-15T00:00:00.000Z"),
        prospectus_snapshot: {
          page_1: {
            issuer_track_record: {
              ...frozenPage1.issuer_track_record,
            },
            historical_notes: [
              {
                note_id: "hist-x",
                note_reference: "NOTE-X",
                financing_type: "ARF-i",
                funded_amount: null,
                listing_opens_at: "2025-01-01T00:00:00.000Z",
                maturity_date: "2025-04-01T00:00:00.000Z",
                profit_rate_percent: "10",
                status: "REPAID",
                repaid_at: null,
                updated_at: "2025-04-01T00:00:00.000Z",
              },
            ],
          },
        },
      })
    );
    expect(page.historicalNoteTable.rows[0]?.amountRm).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(page.historicalNoteTable.rows[0]?.repaymentDate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    const empty = await mapProspectusPageOneFromNote(
      baseNote({
        status: NoteStatus.PUBLISHED,
        published_at: new Date("2025-05-15T00:00:00.000Z"),
        prospectus_snapshot: {
          page_1: {
            issuer_track_record: frozenPage1.issuer_track_record,
            historical_notes: [],
          },
        },
      })
    );
    expect(empty.historicalNoteTable.rows).toHaveLength(0);
    expect(empty.historicalNoteTable.emptyStateMessage).toBe(
      PROSPECTUS_HISTORICAL_NOTE_EMPTY_STATE
    );
  });

  it("malformed published snapshot does not use live rows", async () => {
    await mapProspectusPageOneFromNote(
      baseNote({
        status: NoteStatus.PUBLISHED,
        published_at: new Date("2025-05-15T00:00:00.000Z"),
        prospectus_snapshot: {
          page_1: {
            issuer_track_record: frozenPage1.issuer_track_record,
            historical_notes: [{ note_id: "bad" }],
          },
        },
      })
    );
    expect(mockLiveSnapshot).not.toHaveBeenCalled();
  });

  it("unpublished Stage 8 preview uses live snapshot path with same-issuer exclusion args", async () => {
    mockLiveSnapshot.mockResolvedValue({
      issuer_track_record: {
        total_notes_funded: 0,
        total_amount_funded: "0",
        successful_repayment_percent: null,
        on_time_payment_rate_six_months_percent: null,
        calculated_at: "2025-05-15T00:00:00.000Z",
      },
      historical_notes: [
        {
          note_id: "hist-live",
          note_reference: "NOTE-LIVE-1",
          financing_type: "ARF-i",
          funded_amount: "400000",
          listing_opens_at: "2025-01-01T00:00:00.000Z",
          maturity_date: "2025-04-01T00:00:00.000Z",
          profit_rate_percent: "10",
          status: "ACTIVE",
          repaid_at: null,
          updated_at: "2025-03-01T00:00:00.000Z",
        },
      ],
    });

    const page = await mapProspectusPageOneFromNote(baseNote());
    expect(mockLiveSnapshot).toHaveBeenCalledWith({
      issuerOrganizationId: "org-issuer-1",
      currentNoteId: "note-current",
    });
    expect(page.historicalNoteTable.rows[0]?.amountRm).toBe("RM 400,000.00");
    expect(page.historicalNoteTable.audit.snapshot.snapshotDecision).toBe("live_preview");
  });
});

describe("prospectus Page 1 assembly and HTML", () => {
  it("assembles all 13 sections in approved order", () => {
    const page = SAMPLE_PROSPECTUS_PAGE_ONE;
    const keys = [
      "noteIdentity",
      "datesPaymaster",
      "riskAssessment",
      "mainFinancialTerms",
      "timingPurpose",
      "paymentBasisShariah",
      "paymasterHighlight",
      "issuerFundamentalsHighlight",
      "returnHighlight",
      "shariahHighlight",
      "atAGlance",
      "issuerTrackRecord",
      "historicalNoteTable",
    ] as const;
    for (const key of keys) {
      expect(page[key]).toBeDefined();
    }

    const html = renderProspectusPageOneHtml(page);
    const stageOrder = [
      'data-stage="1"',
      'data-stage="2"',
      'data-stage="3"',
      'data-stage="4a"',
      'data-stage="4b"',
      'data-stage="4c"',
      'data-stage="5a"',
      'data-stage="5b"',
      'data-stage="5c"',
      'data-stage="5d"',
      'data-stage="6"',
      'data-stage="7"',
      'data-stage="8"',
    ];
    let cursor = -1;
    for (const marker of stageOrder) {
      const at = html.indexOf(marker);
      expect(at).toBeGreaterThan(cursor);
      cursor = at;
    }
    expect((html.match(/data-page="prospectus-page-one"/g) ?? []).length).toBe(1);
    const historicalIdx = html.indexOf('data-stage="8"');
    expect(historicalIdx).toBeGreaterThan(-1);
    expect(html.indexOf('data-stage="footer"')).toBeGreaterThan(historicalIdx);
    expect(html).not.toContain("Source Note:");
    expect(html).not.toContain("source-statement");
    expect(html).not.toMatch(/Source: Audited Financial Statements/i);
    expect(html).toContain("prospectus-footer");
    expect(html).toContain('data-stage="footer"');
    expect(html).toContain("Product Terms and Risk Disclosure Statement");
    expect(html).toContain("Investments are subject to credit risk");
    expect(html).not.toContain("Investment are subjects");
  });

  it("renders Closing Date in the Page 1 hero after Listing Date and before Maturity Date", () => {
    const html = renderProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
    const listingIdx = html.indexOf("<b>Listing Date</b>");
    const closingIdx = html.indexOf("<b>Closing Date</b>");
    const maturityIdx = html.indexOf("<b>Maturity Date</b>");
    const paymasterIdx = html.indexOf("<b>Paymaster</b>");
    expect(listingIdx).toBeGreaterThan(-1);
    expect(closingIdx).toBeGreaterThan(listingIdx);
    expect(maturityIdx).toBeGreaterThan(closingIdx);
    expect(paymasterIdx).toBeGreaterThan(maturityIdx);

    expect(html).toContain("<b>Closing Date</b><span>29 May 2025 (14 days)</span>");
    expect(html).toContain("<b>Listing Date</b><span>15 May 2025</span>");
    expect(html).not.toContain("Data not available");
    expect(html).not.toContain(">N/A<");
  });

  it("renders — for missing Closing Date in the Page 1 hero", () => {
    const page = buildProspectusPageOne({
      ...SAMPLE_PROSPECTUS_PAGE_ONE_INPUT,
      datesPaymaster: {
        ...SAMPLE_PROSPECTUS_PAGE_ONE_INPUT.datesPaymaster,
        listingClosesAt: null,
      },
    });
    expect(page.datesPaymaster.closingDate).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    const html = renderProspectusPageOneHtml(page);
    expect(html).toMatch(/<b>Closing Date<\/b><span>—<\/span>/);
    expect(html).not.toContain("Data not available");
  });

  it("uses server listingClosesAt for Closing Date (not a client-overridable field)", () => {
    const page = buildProspectusPageOne({
      ...SAMPLE_PROSPECTUS_PAGE_ONE_INPUT,
      datesPaymaster: {
        ...SAMPLE_PROSPECTUS_PAGE_ONE_INPUT.datesPaymaster,
        listingClosesAt: "2025-06-01T00:00:00.000Z",
      },
    });
    expect(page.datesPaymaster.closingDate).toContain("1 June 2025");
    const html = renderProspectusPageOneHtml(page);
    expect(html).toContain("1 June 2025");
  });

  it("omits audit metadata, Prisma IDs, source paths, and debug JSON", () => {
    const html = renderProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
    expect(html).not.toContain("sample-note-page-one");
    expect(html).not.toContain("canonicalSource");
    expect(html).not.toContain("notes.target_amount");
    expect(html).not.toContain("frozen_at_publish");
    expect(html).not.toContain('"audit"');
    expect(html).not.toContain("source_application_id");
    expect(html).toContain(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(html).toContain(`${PROSPECTUS_PAGE_ONE_WIDTH_MM}mm`);
    expect(html).toContain(`${PROSPECTUS_PAGE_ONE_HEIGHT_MM}mm`);
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("uses full money formatting and introduces no compact-money helper", () => {
    expect(formatProspectusMoneyMyr(3_500_000)).toBe("RM 3,500,000.00");
    expect(formatProspectusMoneyMyr(500_000)).toBe("RM 500,000.00");
    expect(formatProspectusMoneyMyr(100)).toBe("RM 100.00");

    const html = renderProspectusPageOneHtml(SAMPLE_PROSPECTUS_PAGE_ONE);
    expect(html).toContain("RM 3,450,000.00");
    expect(html).toContain("RM 500,000.00");
    expect(html).not.toMatch(/\bmil\b|million|500k|500K/);

    const mapperSrc = readFileSync(join(__dirname, "prospectus-page-one-mapper.ts"), "utf8");
    const htmlSrc = readFileSync(join(__dirname, "prospectus-page-one.html.ts"), "utf8");
    expect(mapperSrc).not.toMatch(/compact.*money|formatCompact|million|mil\b/i);
    expect(htmlSrc).not.toMatch(/compact.*money|formatCompact/i);
  });
});

describe("prospectus Page 1 builder input money edge cases", () => {
  it("formats 3,500,000 through Stage 4A and Stage 7 paths", () => {
    const input: ProspectusPageOneBuilderInput = {
      noteId: "n1",
      noteIdentity: {
        noteReference: "NOTE-X",
        productSnapshotProductName: "ARF",
        productSnapshotDescription: "d",
      },
      datesPaymaster: {
        listingOpensAt: "2025-01-01T00:00:00.000Z",
        listingClosesAt: "2025-01-08T00:00:00.000Z",
        maturityDate: "2025-04-01T00:00:00.000Z",
        paymasterName: "P",
        paymasterEntityType: "T",
      },
      riskAssessment: { soukscoreRiskRating: "A" },
      mainFinancialTerms: { targetAmount: 3_500_000, profitRatePercent: 10 },
      timingPurpose: {
        listingOpensAt: "2025-01-01T00:00:00.000Z",
        maturityDate: "2025-04-01T00:00:00.000Z",
        purposeSnapshotFinancingFor: "purpose",
      },
      paymentBasisShariah: {},
      paymasterHighlight: { paymasterName: "P", paymasterEntityType: "T" },
      issuerFundamentalsHighlight: { financialYearsAvailable: [] },
      returnHighlight: {
        profitRatePercent: 10,
        listingOpensAt: "2025-01-01T00:00:00.000Z",
        maturityDate: "2025-04-01T00:00:00.000Z",
        serviceFeeRatePercent: 10,
      },
      trackRecordMode: "frozen_publication_snapshot",
      page1TrackRecordSnapshot: {
        issuer_track_record: {
          total_notes_funded: 1,
          total_amount_funded: "3500000",
          successful_repayment_percent: 100,
          on_time_payment_rate_six_months_percent: 100,
          calculated_at: "2025-01-01T00:00:00.000Z",
        },
        historical_notes: [],
      },
    };
    const page = buildProspectusPageOne(input);
    expect(page.mainFinancialTerms.financingAmount).toBe("RM 3,500,000.00");
    expect(page.issuerTrackRecord.totalAmountFunded).toBe("RM 3,500,000.00");
  });
});
