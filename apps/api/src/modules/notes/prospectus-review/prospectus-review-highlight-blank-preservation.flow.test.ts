/**
 * SECTION: Prospectus Review — Investor Highlights blank-value preservation (flow-level)
 *
 * WHY: Verify Save Draft -> GET -> Preview/publication all respect explicit blanks ("")
 * while still applying recommendations when highlight values are genuinely missing/absent.
 */

import { NoteStatus, type Prisma } from "@prisma/client";
import {
  PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT,
  buildProspectusHighlightRecommendations,
} from "@cashsouk/types";
import { emptyProspectusReviewContent } from "./prospectus-review-content";
import type { ProspectusReviewStoredContent } from "./prospectus-review-content";
import { ProspectusReviewService } from "./prospectus-review.service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNoteFindUnique = jest.fn();
const mockReviewFindUnique = jest.fn();
const mockFindUniqueOrThrow = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();
const mockTransaction = jest.fn();
const mockAdminActionCreate = jest.fn();
const mockNoteEventCreate = jest.fn();

const mockBuildPageOne = jest.fn(
  (input: {
    publicationContent?: { keyInvestorHighlights?: Array<{ title?: string; key?: string }> };
  }) => {
    const editableTitles = (input.publicationContent?.keyInvestorHighlights ?? [])
      .filter((h) => h.key !== "shariah")
      .map((h) => h.title ?? "");
    const editableEcho = editableTitles.join("|");
    const shariahEcho =
      input.publicationContent?.keyInvestorHighlights?.find((h) => h.key === "shariah")?.title ??
      "";
    return { _echo: editableEcho, _shariahEcho: shariahEcho, issuerTrackRecord: {}, historicalNoteTable: {} };
  }
);

const mockBuildPageOneHtml = jest.fn(
  (page: { _echo?: string }) =>
    `<html><body data-prospectus-page="prospectus-page-one"><p>${page._echo ?? ""}</p><p data-shariah>${(page as any)._shariahEcho ?? ""}</p></body></html>`
);

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    note: { findUnique: (...args: unknown[]) => mockNoteFindUnique(...args) },
    noteProspectusReview: {
      findUnique: (...args: unknown[]) => mockReviewFindUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    noteProspectusPublication: { create: jest.fn() },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    noteAdminAction: { create: (...args: unknown[]) => mockAdminActionCreate(...args) },
    noteEvent: { create: (...args: unknown[]) => mockNoteEventCreate(...args) },
  },
}));

jest.mock("../prospectus/prospectus-page-one-prisma", () => ({
  loadProspectusPageOneNote: jest.fn(async () => ({
    id: "note-1",
    note_reference: "SYSTEM-NOTE-REF",
  })),
}));

jest.mock("../prospectus/prospectus-page-one-mapper", () => ({
  mapProspectusPageOneDataToInput: jest.fn(async () => ({
    trackRecordMode: "live_unpublished_preview",
    page1TrackRecordSnapshot: null,
    publicationContent: undefined,
  })),
  buildProspectusPageOne: (...args: unknown[]) => mockBuildPageOne(args[0] as any),
  buildProspectusPageOneHtml: jest.fn(),
}));

jest.mock("../prospectus/prospectus-page-one.html", () => ({
  buildProspectusPageOneHtml: (...args: unknown[]) => mockBuildPageOneHtml(args[0] as any),
}));

jest.mock("../prospectus/prospectus-page-two-prisma", () => ({
  loadProspectusPageTwoData: jest.fn(async () => ({})),
}));

jest.mock("../prospectus/prospectus-page-two-mapper", () => ({
  mapProspectusPageTwoDataToInput: jest.fn(() => ({ isPublished: false })),
  buildProspectusPageTwo: jest.fn(() => ({
    issuerProfile: { industry: "Construction" },
    invoicePaymaster: {},
    paymasterTrackRecord: {},
    financialComparisonMetrics: {},
    financialComparisonSource: { years: [], opsWarning: null, missingSsmUnauditedYears: [] },
  })),
}));

jest.mock("../prospectus/prospectus-page-two.html", () => ({
  buildProspectusPageTwoHtml: jest.fn(() => "<p>p2</p>"),
}));

jest.mock("../prospectus/prospectus-page-three-prisma", () => ({
  loadProspectusPageThreeData: jest.fn(async () => ({})),
}));

jest.mock("../prospectus/prospectus-page-three-mapper", () => ({
  mapProspectusPageThreeDataToInput: jest.fn(() => ({})),
  buildProspectusPageThree: jest.fn(() => ({})),
}));

jest.mock("../prospectus/prospectus-page-three.html", () => ({
  buildProspectusPageThreeHtml: jest.fn(() => "<p>p3</p>"),
}));

jest.mock("../prospectus/prospectus-marc-appendix.html", () => ({
  buildProspectusPageFourHtml: jest.fn(() => "<p>p4</p>"),
  buildProspectusPageFiveHtml: jest.fn(() => "<p>p5</p>"),
}));

// Simplify admin DTO projections; they aren’t needed for highlight assertions.
jest.mock("../prospectus/prospectus-issuer-track-record", () => ({
  toAdminIssuerTrackRecordRows: jest.fn(() => []),
}));
jest.mock("../prospectus/prospectus-historical-note-table", () => ({
  toAdminHistoricalNoteTable: jest.fn(() => ({ headers: [], rows: [], emptyStateMessage: null })),
}));
jest.mock("../prospectus/prospectus-issuer-profile", () => ({
  toAdminIssuerProfileRows: jest.fn(() => []),
}));
jest.mock("../prospectus/prospectus-invoice-paymaster", () => ({
  toAdminInvoicePaymasterRows: jest.fn(() => []),
}));
jest.mock("../prospectus/prospectus-paymaster-track-record", () => ({
  toAdminPaymasterTrackRecordRows: jest.fn(() => []),
}));
jest.mock("../prospectus/prospectus-financial-comparison-metrics", () => ({
  ...jest.requireActual("../prospectus/prospectus-financial-comparison-metrics"),
  toAdminFinancialComparisonTable: jest.fn(() => ({
    yearHeaders: [],
    rows: [],
    sourceFooter: "",
  })),
  toAdminFrozenFinancialYears: jest.fn(() => []),
}));

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const actor = {
  userId: "admin-1",
  role: "ADMIN" as const,
  portal: "ADMIN" as const,
  ipAddress: "127.0.0.1",
  userAgent: "test",
  correlationId: "corr-1",
};

const noteId = "note-1";
const savedUpdatedAt = new Date("2026-07-19T10:00:00.000Z");

function highlightFromKey(draft: ProspectusReviewStoredContent, key: string) {
  return draft.page1.keyInvestorHighlights.find((h) => h.key === key)!;
}

describe("Prospectus Review — highlight blank preservation flow", () => {
  let storedDraftContent: ProspectusReviewStoredContent;

  const recommendationInput = {
    paymasterSnapshot: { name: "Kementerian Kerja Raya", entity_type: "Government Agency" },
    riskRating: "SME-3",
    profitRatePercent: 12,
    listingOpensAt: "2025-05-15T00:00:00.000Z",
    maturityDate: "2025-09-12T00:00:00.000Z",
  };

  const recommended = buildProspectusHighlightRecommendations(recommendationInput);

  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildPageOneHtml.mockClear();
    mockBuildPageOne.mockClear();

    storedDraftContent = emptyProspectusReviewContent(recommendationInput);

    // Fresh prisma mocks per test.
    mockTransaction.mockImplementation(async (cb: any) => cb(prismaTxProxy()));

    mockNoteFindUnique.mockImplementation((query: any) => {
      const where = query?.where ?? {};
      // `saveDraft`: prisma.note.findUnique(select status/published_at)
      if (where.id === noteId && query?.select?.status !== undefined) {
        return { status: NoteStatus.DRAFT, published_at: null };
      }

      // `saveDraft` + `getOrCreateReview`: prisma.note.findUnique(select note + snapshots)
      if (
        where.id === noteId &&
        query?.select?.paymaster_snapshot !== undefined
      ) {
        return {
          id: noteId,
          note_reference: "NOTE-REF",
          status: NoteStatus.DRAFT,
          published_at: null,
          title: "Note title",
          paymaster_snapshot: recommendationInput.paymasterSnapshot,
          invoice_snapshot: {},
          purpose_snapshot: {},
          contract_snapshot: {},
          profit_rate_percent: recommendationInput.profitRatePercent,
          maturity_date: new Date(recommendationInput.maturityDate),
          listing: { opens_at: new Date(recommendationInput.listingOpensAt) },
        };
      }

      // `preview`: prisma.note.findUnique(select id only)
      if (where.id === noteId && query?.select?.id) {
        return { id: noteId };
      }

      return null;
    });

    mockReviewFindUnique.mockImplementation((query: any) => {
      if (query?.where?.note_id === noteId) return baseReviewRow();
      return null;
    });

    mockUpdate.mockImplementation(async (args: any) => {
      const data = args?.[0]?.data ?? {};
      if (data?.draft_content !== undefined) {
        storedDraftContent = data.draft_content as unknown as ProspectusReviewStoredContent;
      }
      return baseReviewRow({ draft_content: storedDraftContent, updated_at: new Date() });
    });

    mockCreate.mockImplementation(async () => baseReviewRow({ draft_content: storedDraftContent }));
  });

  function baseReviewRow(overrides: Partial<any> = {}) {
    return {
      id: "review-1",
      note_id: noteId,
      status: "DRAFT",
      content_version: 1,
      option_catalogue_version: "2026.07.19.placeholder.v1",
      draft_content: storedDraftContent as unknown as Prisma.JsonValue,
      approved_content: null,
      approved_snapshot: null,
      approved_publication_id: null,
      approved_by_user_id: null,
      approved_at: null,
      render_fingerprint: null,
      created_by_user_id: actor.userId,
      updated_by_user_id: actor.userId,
      created_at: savedUpdatedAt,
      updated_at: savedUpdatedAt,
      ...overrides,
    };
  }

  function prismaTxProxy() {
    return {
      noteProspectusReview: {
        update: mockUpdate,
      },
      noteAdminAction: { create: mockAdminActionCreate },
      noteEvent: { create: mockNoteEventCreate },
    };
  }

  function buildSavePayloadWithHighlightedValues(
    apply: (draft: ProspectusReviewStoredContent) => ProspectusReviewStoredContent
  ): ProspectusReviewStoredContent {
    const draft = JSON.parse(JSON.stringify(storedDraftContent)) as ProspectusReviewStoredContent;
    return apply(draft);
  }

  it("Save Draft -> GET -> Preview preserves explicit title/description blanks", async () => {
    const draftWithBlanks = buildSavePayloadWithHighlightedValues((d) => {
      for (const key of ["paymaster", "issuer_fundamentals", "return"] as const) {
        const hit = highlightFromKey(d, key);
        hit.title = "";
        hit.description = "";
      }
      // Even if someone tries to clear Shariah, it must be fixed.
      const shariahHit = highlightFromKey(d, "shariah");
      shariahHit.title = "";
      shariahHit.description = "";
      return d;
    });

    const service = new ProspectusReviewService();

    await service.saveDraft(noteId, { draftContent: draftWithBlanks }, actor as any);

    // GET load
    const get = await service.getOrCreateReview(noteId, actor as any);
    const page1 = get.review.draftContent.page1.keyInvestorHighlights;

    for (const key of ["paymaster", "issuer_fundamentals", "return"] as const) {
      const hit = page1.find((h) => h.key === key)!;
      expect(hit.title).toBe("");
      expect(hit.description).toBe("");
    }
    expect(get.review.draftContent.page1.keyInvestorHighlights.find((h) => h.key === "shariah"))
      .toEqual({
        key: "shariah",
        title: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.title,
        description: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.description,
      });

    // Preview uses publication conversion, so it must also preserve blanks.
    const preview = await service.preview(noteId, actor as any);
    expect(preview.html.page1).toContain('data-prospectus-page="prospectus-page-one"');

    // Explicitly blank fields should not revert to recommendations.
    expect(preview.html.page1).not.toContain(recommended.paymaster.title);
    expect(preview.html.page1).not.toContain(recommended.issuer_fundamentals.title);
    expect(preview.html.page1).not.toContain(recommended.return.title);

    // Shariah must still be fixed in preview output.
    expect(preview.html.page1).toContain(PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.title);
  });

  it("Missing highlight fields (absent properties) still populate recommended values", async () => {
    const missingDraft = buildSavePayloadWithHighlightedValues((d) => {
      for (const key of ["paymaster", "issuer_fundamentals", "return"] as const) {
        const hit = highlightFromKey(d, key) as any;
        delete hit.title;
        delete hit.description;
      }
      return d;
    });

    const service = new ProspectusReviewService();
    await service.saveDraft(noteId, { draftContent: missingDraft }, actor as any);

    const get = await service.getOrCreateReview(noteId, actor as any);
    for (const key of ["paymaster", "issuer_fundamentals", "return"] as const) {
      const hit = get.review.draftContent.page1.keyInvestorHighlights.find((h) => h.key === key)!;
      const expectedTitle = (recommended as any)[key].title;
      const expectedDescription = (recommended as any)[key].description;
      expect(hit.title).toBe(expectedTitle);
      expect(hit.description).toBe(expectedDescription);
    }

    const preview = await service.preview(noteId, actor as any);
    expect(preview.html.page1).toContain(recommended.paymaster.title);
    expect(preview.html.page1).toContain(recommended.issuer_fundamentals.title);
    expect(preview.html.page1).toContain(recommended.return.title);
  });

  it("Legacy marker + empty title/description restores recommendations (compat)", async () => {
    const legacyDraft = buildSavePayloadWithHighlightedValues((d) => {
      for (const key of ["paymaster", "issuer_fundamentals", "return"] as const) {
        const hit = highlightFromKey(d, key) as any;
        hit.optionKey = `placeholder_${key}`;
        hit.isVisible = true;
        hit.title = "";
        hit.description = "";
      }
      return d;
    });

    const service = new ProspectusReviewService();
    await service.saveDraft(noteId, { draftContent: legacyDraft }, actor as any);

    const get = await service.getOrCreateReview(noteId, actor as any);
    for (const key of ["paymaster", "issuer_fundamentals", "return"] as const) {
      const hit = get.review.draftContent.page1.keyInvestorHighlights.find((h) => h.key === key)!;
      expect(hit.title).toBe((recommended as any)[key].title);
      expect(hit.description).toBe((recommended as any)[key].description);
    }

    const preview = await service.preview(noteId, actor as any);
    expect(preview.html.page1).toContain(recommended.paymaster.title);
    expect(preview.html.page1).toContain(recommended.issuer_fundamentals.title);
    expect(preview.html.page1).toContain(recommended.return.title);
  });
});

