/**
 * Integration-style regression:
 * Approved/READY_FOR_PUBLISH Preview must render Page 2/3 financials from
 * review.approved_snapshot.page_2.financial_comparison (frozen), not from LIVE CTOS/Application.
 *
 * WHY:
 * - Live CTOS can drift between approval and note publish.
 * - Final investor PDF uses frozen approved snapshot; Preview must match.
 */

import { ProspectusReviewService } from "./prospectus-review.service";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    note: { findUnique: jest.fn() },
    noteProspectusReview: { findUnique: jest.fn() },
    application: { findUnique: jest.fn() },
    ctosReport: { findFirst: jest.fn() },
  },
}));

jest.mock("../prospectus/prospectus-marc-snapshot", () => ({
  resolveMarcSnapshotForProspectus: async () => null,
}));

// Keep Page 1 isolated from this test.
jest.mock("../prospectus/prospectus-page-one-prisma", () => {
  const actual = jest.requireActual("../prospectus/prospectus-page-one-prisma");
  return {
    ...actual,
    // Force "note unpublished" behaviour.
    isProspectusNotePublished: () => false,
  };
});

jest.mock("../prospectus/prospectus-page-one-mapper", () => ({
  mapProspectusPageOneDataToInput: () => ({
    trackRecordMode: "live_unpublished_preview",
    publicationContent: undefined,
    page1TrackRecordSnapshot: {},
  }),
  buildProspectusPageOne: () => ({}),
}));

jest.mock("../prospectus/prospectus-page-one.html", () => ({
  buildProspectusPageOneHtml: () => "<p>p1</p>",
}));

// Keep non-financial pages isolated.
jest.mock("../prospectus/prospectus-marc-appendix.html", () => ({
  buildProspectusPageFourHtml: () => "<p>p4</p>",
  buildProspectusPageFiveHtml: () => "<p>p5</p>",
}));
jest.mock("../prospectus/combine-prospectus-pages-html", () => ({
  combineProspectusPagesHtml: (bundle: any) =>
    `ALL_PAGES:${bundle.page1}|${bundle.page2}|${bundle.page3}|${bundle.page4 ?? ""}|${bundle.page5 ?? ""}`,
}));

jest.mock("../prospectus/prospectus-pdf", () => ({
  generateAndStoreProspectusPdf: jest.fn(async () => ({
    storageBucket: "b",
    storageKey: "k",
    contentType: "application/pdf",
    sizeBytes: 1,
    sha256: "a".repeat(64),
    generatedAt: new Date(),
    generationStatus: "READY",
    snapshotHash: "ignored",
    pageCount: 3,
  })),
}));

const noteId = "note-1";
const issuerOrgId = "issuer-1";
const sourceApplicationId = "app-1";

function mkCtosRow({
  year,
  turnover,
  plnpat,
  bscatot,
  totlib,
  return_on_equity,
  currat,
}: {
  year: number;
  turnover: number;
  plnpat: number;
  bscatot: number;
  totlib: number;
  return_on_equity: number;
  currat: number;
}) {
  return {
    financial_year: year,
    dates: { pldd: `${year}-12-31`, bsdd: null },
    account: {
      turnover,
      plnpat,
      bscatot,
      totlib,
      return_on_equity,
      currat,
      // Fill other CTOS numeric keys with null to keep financial-year selection logic stable.
      bsqpuc: null,
      curlib: null,
      plnpbt: null,
      bsfatot: null,
      othass: null,
      bsclbank: null,
      bsslltd: null,
      bsclstd: null,
      totass: null,
      networth: null,
      profit_margin: null,
      gear: null,
      currat,
    },
  };
}

function mkApplicationFinancialStatements({
  year,
  turnover,
  plnpat,
  bscatot,
}: {
  year: number;
  turnover: number;
  plnpat: number;
  bscatot: number;
}) {
  // Prospectus year selection uses questionnaire. We provide only the minimum fields needed by helpers.
  return {
    questionnaire: {
      financial_year_end: `${year}-12-31`,
    },
    // For live-unpublished preview, Page 2/3 may reuse unaudited_by_year; CTOS is the main source for our assertions.
    unaudited_by_year: {
      [String(year)]: {
        turnover,
        plnpat,
        bscatot,
      },
    },
  };
}

function frozenFinancialComparisonFromApprovedSnapshot({
  year,
  turnover,
  plnpat,
  bscatot,
  totlib,
  return_on_equity,
  currat,
}: {
  year: number;
  turnover: number;
  plnpat: number;
  bscatot: number;
  totlib: number;
  return_on_equity: number;
  currat: number;
}) {
  return {
    financial_comparison: {
      // A single selected year is enough; Page 2/3 padding will create placeholders for adjacent columns.
      selected_years: [
        {
          year,
          year_label: `FY${year}`,
          financial_year_end_label: `${year}-12-31`,
          financial_year_end_iso: `${year}-12-31`,
          record_source: "ctos_audited",
          raw_financials: {
            turnover,
            plnpat,
            bscatot,
            totlib,
            return_on_equity,
            currat,
            // Other frozen keys (kept present for robustness).
            bsqpuc: null,
            curlib: null,
            plnpbt: null,
            bsfatot: null,
            othass: null,
            bsclbank: null,
            bsslltd: null,
            bsclstd: null,
            totass: null,
            networth: null,
            profit_margin: null,
            gear: null,
          },
        },
      ],
      source_footer: "Source: Financial Statements",
      calculated_at: new Date().toISOString(),
    },
  };
}

function approvedSnapshot({
  page1Tag,
  finance,
}: {
  page1Tag: string;
  finance: ReturnType<typeof frozenFinancialComparisonFromApprovedSnapshot>;
}) {
  return {
    publication_id: "pub-1",
    content_version: 1,
    render_fingerprint: "fp-1",
    calculated_at: new Date().toISOString(),
    page_1: { tag: page1Tag },
    page_2: finance,
    publication_content: {},
    note_identity: {},
    html: { page1: "p1", page2: "p2", page3: "p3" },
  };
}

describe("approved Preview financial freeze (Page 2/3)", () => {
  const service = new ProspectusReviewService();

  const fy = 2025;

  const live = {
    turnover: 12_000_000,
    plnpat: 1_000_000 * 2,
    bscatot: 6_000_000,
    totlib: 4_000_000,
    return_on_equity: 25,
    currat: 1.8,
  };

  const frozen = {
    turnover: 10_000_000,
    plnpat: 1_000_000,
    bscatot: 5_000_000,
    totlib: 3_000_000,
    return_on_equity: 20,
    currat: 1.5,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const prisma = require("../../../lib/prisma").prisma as any;

    // Note: keep it unpublished.
    prisma.note.findUnique.mockImplementation((query: any) => {
      if (query?.select?.id && Object.keys(query.select).length === 1) {
        return { id: noteId };
      }
      if (query?.select?.financial_statements !== undefined) {
        // Not expected in this suite.
        return null;
      }

      // Called by Page 1 loader and Page 2/3 loaders (PROSPECTUS_*_NOTE_SELECT).
      return {
        id: noteId,
        note_reference: "NR-1",
        status: "DRAFT",
        published_at: null,
        source_application_id: sourceApplicationId,
        issuer_organization_id: issuerOrgId,
        invoice_snapshot: { details: { value: 1, maturity_date: null }, offer_details: { risk_rating: "SME-3" } },
        paymaster_snapshot: { name: "PM", entity_type: "Corporate" },
        issuer_snapshot: {
          name: "Issuer",
          registration_number: "123",
          industry: "Construction",
          entity_type: "Company",
          country: "Registered in Malaysia",
          business_description: "Infrastructure works",
        },
        prospectus_snapshot: {},
        product_snapshot: {},
        purpose_snapshot: {},
        contract_snapshot: {},
        target_amount: 1,
        funded_amount: 1,
        profit_rate_percent: 1,
        service_fee_rate_percent: 1,
        platform_fee_rate_percent: 1,
        maturity_date: null,
        listing: { opens_at: new Date(), closes_at: new Date() },
      };
    });

    // Review row.
    const draftContent = buildCompleteProspectusReviewDraft() as any;

    const financeFrozen = frozenFinancialComparisonFromApprovedSnapshot({
      year: fy,
      turnover: frozen.turnover,
      plnpat: frozen.plnpat,
      bscatot: frozen.bscatot,
      totlib: frozen.totlib,
      return_on_equity: frozen.return_on_equity,
      currat: frozen.currat,
    });

    prisma.noteProspectusReview.findUnique.mockImplementation(() => {
      // status is overridden per test below.
      const approvedContent = draftContent;
      const snap = approvedSnapshot({ page1Tag: "X", finance: financeFrozen });
      return {
        id: "rev-1",
        note_id: noteId,
        status: "DRAFT",
        content_version: 1,
        option_catalogue_version: "opt-v1",
        draft_content: draftContent,
        approved_content: approvedContent,
        approved_snapshot: snap,
        approved_publication_id: approvedContent ? "pub-1" : null,
        render_fingerprint: approvedContent ? "fp-1" : null,
        created_by_user_id: "admin-1",
        updated_by_user_id: "admin-1",
        approved_by_user_id: approvedContent ? "admin-1" : null,
        approved_at: approvedContent ? new Date("2026-07-19T00:00:00.000Z") : null,
        created_at: new Date("2026-07-19T00:00:00.000Z"),
        updated_at: new Date("2026-07-19T00:00:00.000Z"),
      };
    });

    // Live Application financials (RM12m values).
    prisma.application.findUnique.mockImplementation(() => ({
      financial_statements: mkApplicationFinancialStatements({
        year: fy,
        turnover: live.turnover,
        plnpat: live.plnpat,
        bscatot: live.bscatot,
      }),
    }));

    // Live CTOS financials_json (RM12m values).
    prisma.ctosReport.findFirst.mockImplementation(() => ({
      financials_json: [
        mkCtosRow({
          year: fy,
          turnover: live.turnover,
          plnpat: live.plnpat,
          bscatot: live.bscatot,
          totlib: live.totlib,
          return_on_equity: live.return_on_equity,
          currat: live.currat,
        }),
      ],
    }));
  });

  function setReviewStatus(status: "DRAFT" | "APPROVED" | "READY_FOR_PUBLISH") {
    const prisma = require("../../../lib/prisma").prisma as any;
    prisma.noteProspectusReview.findUnique.mockImplementation(() => ({
      ...(prisma.noteProspectusReview.findUnique as any).mock.results?.[0]?.value,
      id: "rev-1",
      note_id: noteId,
      status,
    }));
  }

  function assertPage2And3FrozenVsLive(opts: {
    expectedRevenueMil: string;
    expectedPatMil: string;
    expectedCurrentAssetsMil: string;
    expectedTotalLiabilitiesMil: string;
    expectedRoePercent: string;
    expectedCurrentRatioX: string;
    unexpectedRevenueMil: string;
    unexpectedPatMil: string;
    unexpectedCurrentAssetsMil: string;
    unexpectedTotalLiabilitiesMil: string;
    unexpectedRoePercent: string;
    unexpectedCurrentRatioX: string;
  }) {
    return {
      expectedRevenueMil: opts.expectedRevenueMil,
      expectedPatMil: opts.expectedPatMil,
      expectedCurrentAssetsMil: opts.expectedCurrentAssetsMil,
      expectedTotalLiabilitiesMil: opts.expectedTotalLiabilitiesMil,
      expectedRoePercent: opts.expectedRoePercent,
      expectedCurrentRatioX: opts.expectedCurrentRatioX,
      unexpectedRevenueMil: opts.unexpectedRevenueMil,
      unexpectedPatMil: opts.unexpectedPatMil,
      unexpectedCurrentAssetsMil: opts.unexpectedCurrentAssetsMil,
      unexpectedTotalLiabilitiesMil: opts.unexpectedTotalLiabilitiesMil,
      unexpectedRoePercent: opts.unexpectedRoePercent,
      unexpectedCurrentRatioX: opts.unexpectedCurrentRatioX,
    };
  }

  async function renderPreview(status: "DRAFT" | "APPROVED" | "READY_FOR_PUBLISH") {
    const prisma = require("../../../lib/prisma").prisma as any;
    prisma.noteProspectusReview.findUnique.mockImplementation(() => {
      const draftContent = buildCompleteProspectusReviewDraft() as any;
      const financeFrozen = frozenFinancialComparisonFromApprovedSnapshot({
        year: fy,
        turnover: frozen.turnover,
        plnpat: frozen.plnpat,
        bscatot: frozen.bscatot,
        totlib: frozen.totlib,
        return_on_equity: frozen.return_on_equity,
        currat: frozen.currat,
      });
      const snap = approvedSnapshot({ page1Tag: "X", finance: financeFrozen });
      return {
        id: "rev-1",
        note_id: noteId,
        status,
        content_version: 1,
        option_catalogue_version: "opt-v1",
        draft_content: draftContent,
        approved_content: draftContent,
        approved_snapshot: snap,
        approved_publication_id: "pub-1",
        render_fingerprint: "fp-1",
        created_by_user_id: "admin-1",
        updated_by_user_id: "admin-1",
        approved_by_user_id: status === "DRAFT" ? null : "admin-1",
        approved_at: status === "DRAFT" ? null : new Date("2026-07-19T00:00:00.000Z"),
        created_at: new Date("2026-07-01T00:00:00.000Z"),
        updated_at: new Date("2026-07-01T00:00:00.000Z"),
      };
    });

    return service.preview(noteId, { userId: "admin-1", role: "ADMIN", portal: "ADMIN" } as any);
  }

  it("DRAFT Preview shows LIVE (RM12m)", async () => {
    const result = await renderPreview("DRAFT");
    const page2 = result.html.page2;
    const page3 = result.html.page3;

    // Page 2 revenue + PAT are rendered in MYR millions via formatProspectusMyrMillions.
    expect(page2).toContain("<td>12</td>");
    expect(page2).toContain("<td>2</td>");

    // Page 3 current assets come from the live application year.
    // That year is reviewed User Input, so CTOS-only total liabilities are not mixed in.
    expect(page3).toContain("<td>6</td>");
    expect(page3).toContain("Source: Management Accounts");

    expect(page3).not.toContain("20%");
    expect(page3).not.toContain("1.5x");

    // Ensure frozen values are not rendered.
    expect(page3).not.toContain("<td>5</td>");
    expect(page3).not.toContain("<td>3</td>");
  });

  it("APPROVED Preview (Note unpublished) uses frozen RM10m", async () => {
    const result = await renderPreview("APPROVED");
    const page2 = result.html.page2;
    const page3 = result.html.page3;

    expect(page2).toContain("<td>10</td>");
    expect(page2).toContain("<td>1</td>");
    expect(page2).not.toContain("<td>12</td>");
    expect(page2).not.toContain("<td>2</td>");

    expect(page3).toContain("<td>5</td>");
    expect(page3).toContain("<td>3</td>");
    expect(page3).not.toContain("<td>6</td>");
    expect(page3).not.toContain("<td>4</td>");

    expect(page3).toContain("20%");
    expect(page3).not.toContain("25%");
    expect(page3).toContain("1.5x");
    expect(page3).not.toContain("1.8x");
  });

  it("READY_FOR_PUBLISH Preview (Note unpublished) uses frozen RM10m", async () => {
    const result = await renderPreview("READY_FOR_PUBLISH");
    const page2 = result.html.page2;
    const page3 = result.html.page3;

    expect(page2).toContain("<td>10</td>");
    expect(page2).toContain("<td>1</td>");
    expect(page2).not.toContain("<td>12</td>");
    expect(page2).not.toContain("<td>2</td>");

    expect(page3).toContain("<td>5</td>");
    expect(page3).toContain("<td>3</td>");
    expect(page3).not.toContain("<td>6</td>");
    expect(page3).not.toContain("<td>4</td>");

    expect(page3).toContain("20%");
    expect(page3).not.toContain("25%");
    expect(page3).toContain("1.5x");
    expect(page3).not.toContain("1.8x");
  });
});

