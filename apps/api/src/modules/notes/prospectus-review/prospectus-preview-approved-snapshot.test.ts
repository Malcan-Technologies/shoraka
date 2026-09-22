/**
 * Regression tests for "Approved Preview must use the frozen approved Page 1 snapshot".
 *
 * WHY:
 * - Saved Preview (GET) previously rendered Page 1 track-record/historical notes from the
 *   current/unpublished Note state (live unpublished preview), even when the Prospectus
 *   review itself was already READY_FOR_PUBLISH/APPROVED.
 * - Final publication/PDF uses the frozen approved_snapshot.page_1.
 *
 * THESE tests verify:
 * - Draft/live preview still uses live/unpublished track-record mode
 * - Approved/READY_FOR_PUBLISH saved preview forces frozen Page 1 snapshot
 * - Final publish-time regeneration also uses the frozen Page 1 snapshot
 */

import { ProspectusReviewService } from "./prospectus-review.service";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";

const mockNoteFindUnique = jest.fn();
const mockReviewFindUnique = jest.fn();

const mockLoadPageOneNote = jest.fn();
const mockMapPageOneDataToInput = jest.fn();

const mockBuildProspectusPageOne = jest.fn();
const mockBuildProspectusPageOneHtml = jest.fn();

const mockBuildProspectusPageTwoHtml = jest.fn(() => "<p>p2</p>");
const mockBuildProspectusPageThreeHtml = jest.fn(() => "<p>p3</p>");
const mockBuildProspectusPageFourHtml = jest.fn(() => "<p>p4</p>");
const mockBuildProspectusPageFiveHtml = jest.fn(() => "<p>p5</p>");

const mockGenerateAndStoreProspectusPdf = jest.fn(async () => ({
  storageBucket: "b",
  storageKey: "k",
  contentType: "application/pdf",
  sizeBytes: 1,
  sha256: "a".repeat(64),
  generatedAt: new Date("2026-07-19T00:00:00.000Z"),
  generationStatus: "READY",
  snapshotHash: "ignored-by-test",
  pageCount: 3,
}));

// Track what snapshot/mode render is using (echoed into HTML).
let liveSnapshotTag = "Y";
let frozenSnapshotTag = "X";
let liveTurnoverTag = 12;
let frozenTurnoverTag = 10;
let liveBscatotTag = 22;
let frozenBscatotTag = 20;

function modeAndTagHtml(mode: string, tag: string) {
  return `<p data-mode="${mode}" data-snap="${tag}"></p>`;
}

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    note: {
      findUnique: (...args: unknown[]) => mockNoteFindUnique(...args),
    },
    noteProspectusReview: {
      findUnique: (...args: unknown[]) => mockReviewFindUnique(...args),
    },
  },
}));

jest.mock("../prospectus/prospectus-page-one-prisma", () => ({
  loadProspectusPageOneNote: (...args: unknown[]) => mockLoadPageOneNote(...args),
  // Page 2 loader relies on this function from the same module.
  // In these tests we simulate "note unpublished" scenarios.
  isProspectusNotePublished: () => false,
}));

jest.mock("../prospectus/prospectus-page-one-mapper", () => ({
  mapProspectusPageOneDataToInput: (...args: unknown[]) => mockMapPageOneDataToInput(...args),
  buildProspectusPageOne: (...args: unknown[]) => mockBuildProspectusPageOne(...args),
}));

jest.mock("../prospectus/prospectus-page-one.html", () => ({
  buildProspectusPageOneHtml: (...args: unknown[]) => mockBuildProspectusPageOneHtml(...args),
}));

jest.mock("../prospectus/prospectus-page-two-mapper", () => ({
  mapProspectusPageTwoDataToInput: () => ({
    noteId: "note-1",
    isPublished: false,
    financialMode: "live_unpublished_preview",
    frozenFinancialComparison: null,
    liveCtosFinancials: { turnover: liveTurnoverTag, bscatot: liveBscatotTag },
    liveFinancialStatements: {},
    issuerSnapshot: {},
    invoiceSnapshot: {},
    paymasterSnapshot: {},
  }),
  buildProspectusPageTwo: (pageInput: any) => {
    const financialMode = pageInput.financialMode;
    const source =
      financialMode === "frozen_publication_snapshot"
        ? pageInput.frozenFinancialComparison?.selected_years?.[0]?.raw_financials
        : pageInput.liveCtosFinancials;
    return {
      _financialMode: financialMode,
      _turnover: source?.turnover,
    };
  },
}));
jest.mock("../prospectus/prospectus-page-two-prisma", () => ({
  loadProspectusPageTwoData: jest.fn(async () => ({})),
}));
jest.mock("../prospectus/prospectus-page-two.html", () => ({
  buildProspectusPageTwoHtml: (...args: unknown[]) => mockBuildProspectusPageTwoHtml(...args),
}));

jest.mock("../prospectus/prospectus-page-three-mapper", () => ({
  mapProspectusPageThreeDataToInput: () => ({
    noteId: "note-1",
    isPublished: false,
    financialMode: "live_unpublished_preview",
    frozenFinancialComparison: null,
    liveCtosFinancials: { turnover: liveTurnoverTag, bscatot: liveBscatotTag },
    liveFinancialStatements: {},
    issuerSnapshot: {},
    invoiceSnapshot: {},
    paymasterSnapshot: {},
  }),
  buildProspectusPageThree: (pageInput: any) => {
    const financialMode = pageInput.financialMode;
    const source =
      financialMode === "frozen_publication_snapshot"
        ? pageInput.frozenFinancialComparison?.selected_years?.[0]?.raw_financials
        : pageInput.liveCtosFinancials;
    return {
      _financialMode: financialMode,
      _bscatot: source?.bscatot,
    };
  },
}));
jest.mock("../prospectus/prospectus-page-three-prisma", () => ({
  loadProspectusPageThreeData: jest.fn(async () => ({})),
}));
jest.mock("../prospectus/prospectus-page-three.html", () => ({
  buildProspectusPageThreeHtml: (...args: unknown[]) => mockBuildProspectusPageThreeHtml(...args),
}));

jest.mock("../prospectus/prospectus-marc-appendix.html", () => ({
  buildProspectusPageFourHtml: (...args: unknown[]) => mockBuildProspectusPageFourHtml(...args),
  buildProspectusPageFiveHtml: (...args: unknown[]) => mockBuildProspectusPageFiveHtml(...args),
}));

jest.mock("../prospectus/combine-prospectus-pages-html", () => ({
  combineProspectusPagesHtml: (bundle: any) =>
    `ALL_PAGES:${bundle.page1}|${bundle.page2}|${bundle.page3}|${bundle.page4 ?? ""}|${
      bundle.page5 ?? ""
    }`,
}));

jest.mock("../prospectus/prospectus-pdf", () => ({
  generateAndStoreProspectusPdf: (...args: unknown[]) => mockGenerateAndStoreProspectusPdf(...args),
}));

// Don’t depend on full publication mapping; track-record rendering is what we’re testing.
jest.mock("./prospectus-review-content", () => {
  const actual = jest.requireActual("./prospectus-review-content");
  return {
    ...actual,
    toProspectusPublicationContent: () => ({}),
  };
});

describe("prospectus approved preview uses frozen Page 1 snapshot", () => {
  const service = new ProspectusReviewService();

  beforeEach(() => {
    jest.clearAllMocks();
    liveSnapshotTag = "Y";
    frozenSnapshotTag = "X";
    liveTurnoverTag = 12;
    frozenTurnoverTag = 10;
    liveBscatotTag = 22;
    frozenBscatotTag = 20;

    mockLoadPageOneNote.mockResolvedValue({ id: "note-1" });

    mockMapPageOneDataToInput.mockImplementation(async () => ({
      trackRecordMode: "live_unpublished_preview",
      page1TrackRecordSnapshot: { tag: liveSnapshotTag },
      publicationContent: undefined,
    }));

    mockBuildProspectusPageOne.mockImplementation((pageInput: any) => ({
      _mode: pageInput.trackRecordMode,
      _tag: pageInput.page1TrackRecordSnapshot?.tag ?? "none",
    }));

    mockBuildProspectusPageOneHtml.mockImplementation((page: any) =>
      modeAndTagHtml(page._mode, page._tag)
    );

    mockBuildProspectusPageTwoHtml.mockImplementation((page: any) => {
      return `<p data-mode="${page._financialMode}" data-turnover="${page._turnover}"></p>`;
    });

    mockBuildProspectusPageThreeHtml.mockImplementation((page: any) => {
      return `<p data-mode="${page._financialMode}" data-bscatot="${page._bscatot}"></p>`;
    });

    // preview() selects note id only
    mockNoteFindUnique.mockImplementation((query: any) => {
      if (query?.select?.id) return { id: "note-1" };
      // previewUnsaved needs Note snapshots for recommendation inputs
      if (query?.select?.paymaster_snapshot !== undefined) {
        return {
          id: "note-1",
          paymaster_snapshot: {},
          invoice_snapshot: {},
          purpose_snapshot: {},
          contract_snapshot: {},
          profit_rate_percent: 12,
          maturity_date: new Date(),
          listing: { opens_at: new Date() },
        };
      }
      // generateFinalProspectusPdfForPublish needs listing opens_at/closes_at
      if (query?.select?.listing) {
        return {
          listing: {
            opens_at: new Date("2026-08-01T00:00:00.000Z"),
            closes_at: new Date("2026-08-15T00:00:00.000Z"),
          },
        };
      }
      return null;
    });
  });

  const frozenApprovedSnapshot = (page1Tag: string) => ({
    publication_id: "pub-1",
    content_version: 1,
    render_fingerprint: "fp-1",
    calculated_at: new Date().toISOString(),
    page_1: { tag: page1Tag },
    page_2: {
      financial_comparison: {
        selected_years: [
          {
            year: 2025,
            raw_financials: { turnover: frozenTurnoverTag, bscatot: frozenBscatotTag },
          },
        ],
      },
    },
    publication_content: {},
    note_identity: {},
    html: { page1: "p1", page2: "p2", page3: "p3" },
  });

  function reviewRow({
    status,
    draftContent = {},
    approvedContent = null,
    approvedSnapshot,
  }: {
    status: string;
    draftContent?: unknown;
    approvedContent?: unknown;
    approvedSnapshot?: unknown;
  }) {
    return {
      id: "rev-1",
      note_id: "note-1",
      status,
      content_version: 1,
      option_catalogue_version: "opt-v1",
      draft_content: draftContent as any,
      approved_content: approvedContent as any,
      approved_snapshot: approvedSnapshot as any,
      approved_publication_id: approvedContent ? "pub-1" : null,
      render_fingerprint: approvedContent ? "fp-1" : null,
      created_by_user_id: "admin-1",
      updated_by_user_id: "admin-1",
      approved_by_user_id: approvedContent ? "admin-1" : null,
      approved_at: approvedContent ? new Date("2026-07-19T00:00:00.000Z") : null,
      created_at: new Date("2026-07-19T00:00:00.000Z"),
      updated_at: new Date("2026-07-19T00:00:00.000Z"),
    };
  }

  it("draft preview (GET) uses live unpublished Page 1 track record", async () => {
    mockReviewFindUnique.mockResolvedValue(
      reviewRow({ status: "DRAFT", approvedContent: null, approvedSnapshot: null })
    );

    const result = await service.preview("note-1", {
      userId: "admin-1",
      role: "ADMIN",
      portal: "ADMIN",
    } as any);

    expect(result.html.page1).toContain('data-mode="live_unpublished_preview"');
    expect(result.html.page1).toContain('data-snap="Y"');
    // DRAFT preview must keep Page 2/3 LIVE (no frozen financial override).
    expect(result.html.page2).toContain('data-mode="live_unpublished_preview"');
    expect(result.html.page2).toContain('data-turnover="12"');
    expect(result.html.page3).toContain('data-mode="live_unpublished_preview"');
    expect(result.html.page3).toContain('data-bscatot="22"');
  });

  it("draft live preview (POST) remains live/unpublished (no frozen override)", async () => {
    mockReviewFindUnique.mockResolvedValue(
      reviewRow({ status: "DRAFT", approvedContent: null, approvedSnapshot: null })
    );

    const result = await service.previewUnsaved(
      "note-1",
      { draftContent: buildCompleteProspectusReviewDraft() } as any,
      { userId: "admin-1", role: "ADMIN", portal: "ADMIN" } as any
    );

    expect(result.html.page1).toContain('data-mode="live_unpublished_preview"');
    expect(result.html.page1).toContain('data-snap="Y"');
  });

  it("approved/READY_FOR_PUBLISH preview (GET) forces frozen approved Page 1 snapshot X", async () => {
    const approvedSnapshot = frozenApprovedSnapshot(frozenSnapshotTag);
    mockReviewFindUnique.mockResolvedValue(
      reviewRow({
        status: "READY_FOR_PUBLISH",
        draftContent: {},
        approvedContent: { any: "approved" },
        approvedSnapshot,
      })
    );

    const result = await service.preview("note-1", {
      userId: "admin-1",
      role: "ADMIN",
      portal: "ADMIN",
    } as any);

    expect(result.html.page1).toContain('data-mode="frozen_publication_snapshot"');
    expect(result.html.page1).toContain('data-snap="X"');
    // Approved preview must also switch Page 2/3 to FROZEN using approved_snapshot.page_2.financial_comparison.
    expect(result.html.page2).toContain('data-mode="frozen_publication_snapshot"');
    expect(result.html.page2).toContain('data-turnover="10"');
    expect(result.html.page3).toContain('data-mode="frozen_publication_snapshot"');
    expect(result.html.page3).toContain('data-bscatot="20"');
  });

  it("approved preview remains on frozen X even if live unpublished track record later changes to Y", async () => {
    const approvedSnapshot = frozenApprovedSnapshot(frozenSnapshotTag);
    mockReviewFindUnique.mockResolvedValue(
      reviewRow({
        status: "APPROVED",
        draftContent: {},
        approvedContent: { any: "approved" },
        approvedSnapshot,
      })
    );

    // First render: live snapshot is Y
    const first = await service.preview("note-1", {
      userId: "admin-1",
      role: "ADMIN",
      portal: "ADMIN",
    } as any);
    expect(first.html.page1).toContain('data-snap="X"');

    // Now change the live snapshot returned by the mapper.
    liveSnapshotTag = "Y";
    mockMapPageOneDataToInput.mockImplementation(async () => ({
      trackRecordMode: "live_unpublished_preview",
      page1TrackRecordSnapshot: { tag: "Y" },
      publicationContent: undefined,
    }));

    // Second render should still use frozen X (approved_snapshot.page_1).
    const second = await service.preview("note-1", {
      userId: "admin-1",
      role: "ADMIN",
      portal: "ADMIN",
    } as any);
    expect(second.html.page1).toContain('data-snap="X"');
  });

  it("final publication/PDF generation uses frozen approved Page 1 snapshot X", async () => {
    const approvedSnapshot: any = {
      publication_content: {},
      render_fingerprint: "fp-1",
      note_identity: {},
      page_1: { tag: frozenSnapshotTag },
      page_2: {},
      publication_id: "pub-1",
      content_version: 1,
      calculated_at: new Date().toISOString(),
      html: { page1: "", page2: "", page3: "" },
    };

    const result = await service.generateFinalProspectusPdfForPublish({
      noteId: "note-1",
      actor: { userId: "admin-1" } as any,
      approvedSnapshot,
      publicationId: "pub-1",
      reviewId: "rev-1",
    });

    expect(result.updatedSnapshot.html.page1).toContain(
      `data-mode="frozen_publication_snapshot"`
    );
    expect(result.updatedSnapshot.html.page1).toContain(`data-snap="X"`);
  });
});

