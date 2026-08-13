/**
 * SECTION: Live Preview from unsaved form payload (no persistence)
 */

import { NoteStatus, ProspectusReviewStatus } from "@prisma/client";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import { ProspectusReviewService } from "./prospectus-review.service";
import { writeNoteAuditFromActor } from "../audit/writer";

jest.mock("../audit/writer", () => {
  const actual = jest.requireActual<typeof import("../audit/writer")>("../audit/writer");
  return {
    ...actual,
    writeNoteAuditFromActor: jest.fn().mockResolvedValue(undefined),
    writeNoteAuditLog: jest.fn().mockResolvedValue(undefined),
  };
});

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();
const mockTransaction = jest.fn();
const mockNoteFindUnique = jest.fn();
const mockAdminActionCreate = jest.fn();
const mockPublicationCreate = jest.fn();

const mockBuildPageOneHtml = jest.fn(
  (page: { _echo?: string }) =>
    `<html><body><section class="page prospectus-page-one" data-page="prospectus-page-one"><p>p1:${page._echo ?? ""}</p></section></body></html>`
);
const mockBuildPageTwoHtml = jest.fn(
  () =>
    `<html><body><section class="page prospectus-page-two" data-page="prospectus-page-two"><p>p2</p></section></body></html>`
);
const mockBuildPageThreeHtml = jest.fn(
  () =>
    `<html><body><section class="page prospectus-page-three" data-page="prospectus-page-three"><p>p3:—</p></section></body></html>`
);
const mockBuildPageOne = jest.fn(
  (input: {
    publicationContent?: { keyInvestorHighlights?: Array<{ title?: string; key?: string }> };
  }) => {
    const echo =
      input.publicationContent?.keyInvestorHighlights?.find((h) => h.key !== "shariah")?.title ??
      input.publicationContent?.keyInvestorHighlights?.[0]?.title ??
      "";
    return {
      _echo: echo,
      issuerTrackRecord: {},
      historicalNoteTable: { rows: [], emptyStateMessage: null },
    };
  }
);const mockBuildPageTwo = jest.fn((input: { publicationContent?: unknown }) => ({
  publicationContent: input.publicationContent,
  issuerProfile: { industry: "Construction", companySize: "Medium" },
}));
const mockBuildPageThree = jest.fn(() => ({
  incomeStatement: { years: [{ year: 2022 }] },
}));

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    note: { findUnique: (...args: unknown[]) => mockNoteFindUnique(...args) },
    noteProspectusReview: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    noteProspectusPublication: {
      create: (...args: unknown[]) => mockPublicationCreate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    noteAdminAction: { create: (...args: unknown[]) => mockAdminActionCreate(...args) },
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
  buildProspectusPageOne: (...args: unknown[]) => mockBuildPageOne(...args),
}));
jest.mock("../prospectus/prospectus-page-one.html", () => ({
  buildProspectusPageOneHtml: (...args: unknown[]) => mockBuildPageOneHtml(...args),
}));
jest.mock("../prospectus/prospectus-page-two-prisma", () => ({
  loadProspectusPageTwoData: jest.fn(async () => ({})),
}));
jest.mock("../prospectus/prospectus-page-two-mapper", () => ({
  mapProspectusPageTwoDataToInput: jest.fn(() => ({})),
  buildProspectusPageTwo: (...args: unknown[]) => mockBuildPageTwo(...args),
}));
jest.mock("../prospectus/prospectus-page-two.html", () => ({
  buildProspectusPageTwoHtml: (...args: unknown[]) => mockBuildPageTwoHtml(...args),
}));
jest.mock("../prospectus/prospectus-page-three-prisma", () => ({
  loadProspectusPageThreeData: jest.fn(async () => ({})),
}));
jest.mock("../prospectus/prospectus-page-three-mapper", () => ({
  mapProspectusPageThreeDataToInput: jest.fn(() => ({})),
  buildProspectusPageThree: (...args: unknown[]) => mockBuildPageThree(...args),
}));
jest.mock("../prospectus/prospectus-page-three.html", () => ({
  buildProspectusPageThreeHtml: (...args: unknown[]) => mockBuildPageThreeHtml(...args),
}));

const actor = {
  userId: "admin-1",
  role: "ADMIN" as const,
  portal: "ADMIN" as const,
  ipAddress: "127.0.0.1",
  userAgent: "test",
  correlationId: "corr-1",
};

const savedUpdatedAt = new Date("2026-07-19T10:00:00.000Z");

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rev-1",
    note_id: "note-1",
    status: ProspectusReviewStatus.DRAFT,
    content_version: 3,
    option_catalogue_version: "2026.07.19.placeholder.v1",
    draft_content: buildCompleteProspectusReviewDraft(),
    approved_content: null,
    approved_snapshot: null,
    approved_publication_id: null,
    render_fingerprint: null,
    created_by_user_id: "admin-1",
    updated_by_user_id: "admin-1",
    approved_by_user_id: null,
    approved_at: null,
    created_at: savedUpdatedAt,
    updated_at: savedUpdatedAt,
    ...overrides,
  };
}

describe("prospectus live preview (unsaved)", () => {
  const service = new ProspectusReviewService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockNoteFindUnique.mockResolvedValue({
      id: "note-1",
      status: NoteStatus.DRAFT,
      published_at: null,
      paymaster_snapshot: {},
      invoice_snapshot: {},
      purpose_snapshot: {},
      contract_snapshot: {},
      profit_rate_percent: 12,
      maturity_date: new Date(),
      listing: { opens_at: new Date() },
    });
    mockFindUnique.mockResolvedValue(baseRow());
  });

  it("renders unsaved officer text from the request payload", async () => {
    const draft = buildCompleteProspectusReviewDraft();
    const target = draft.page1.keyInvestorHighlights.find((h) => h.key !== "shariah");
    expect(target).toBeDefined();
    target!.title = "UNSAVED_LIVE_TITLE_XYZ";

    const result = await service.previewUnsaved(
      "note-1",
      { draftContent: draft },
      actor
    );

    expect(result.previewSource).toBe("unsaved");
    expect(result.html.page1).toContain("UNSAVED_LIVE_TITLE_XYZ");
    expect(result.html.allPages).toContain("UNSAVED_LIVE_TITLE_XYZ");
    expect(result.html.allPages).toContain('data-page="prospectus-page-one"');
    expect(result.html.allPages).toContain('data-page="prospectus-page-two"');
    expect(result.html.allPages).toContain('data-page="prospectus-page-three"');
    expect(
      result.html.allPages.indexOf('data-page="prospectus-page-one"')
    ).toBeLessThan(result.html.allPages.indexOf('data-page="prospectus-page-two"'));
    expect(
      result.html.allPages.indexOf('data-page="prospectus-page-two"')
    ).toBeLessThan(result.html.allPages.indexOf('data-page="prospectus-page-three"'));
    expect(
      (result.html.allPages.match(/data-page="prospectus-page-(one|two|three)"/g) ?? [])
        .length
    ).toBe(3);
    expect(result.draftMarker.toLowerCase()).toContain("unsaved");
  });

  it("does not write review, publication, snapshot, or audit rows", async () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page1.keyInvestorHighlights[0]!.title = "UNSAVED_ONLY";

    await service.previewUnsaved("note-1", { draftContent: draft }, actor);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPublicationCreate).not.toHaveBeenCalled();
    expect(mockAdminActionCreate).not.toHaveBeenCalled();
    expect(writeNoteAuditFromActor).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("does not require expectedUpdatedAt and ignores concurrency tokens", async () => {
    const draft = buildCompleteProspectusReviewDraft();
    const result = await service.previewUnsaved(
      "note-1",
      {
        draftContent: draft,
        expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
      },
      actor
    );
    expect(result.previewSource).toBe("unsaved");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("allows incomplete drafts (approval completeness not required)", async () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.creditInsights = {
      creditScoreOptionKey: null,
      paymentBehaviourOptionKey: null,
      creditUtilisationOptionKey: null,
      litigationCheckOptionKey: null,
      ccrisStatusOptionKey: null,
    };

    const result = await service.previewUnsaved("note-1", { draftContent: draft }, actor);
    expect(result.previewSource).toBe("unsaved");
    expect(result.html.page3).toContain("—");
  });

  it("rejects invalid field formats with draft validation errors", async () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page1.keyInvestorHighlights[0]!.title = "x".repeat(500);

    await expect(
      service.previewUnsaved("note-1", { draftContent: draft }, actor)
    ).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects unknown keys so clients cannot inject system overrides into the payload", async () => {
    const draft = {
      ...buildCompleteProspectusReviewDraft(),
      systemNoteReference: "HACKED-REF",
    };

    await expect(
      service.previewUnsaved("note-1", { draftContent: draft }, actor)
    ).rejects.toBeInstanceOf(Error);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("GET preview uses saved DB content, not an unsaved payload", async () => {
    const saved = buildCompleteProspectusReviewDraft();
    const target = saved.page1.keyInvestorHighlights.find((h) => h.key !== "shariah");
    expect(target).toBeDefined();
    target!.title = "SAVED_DB_TITLE";
    mockFindUnique.mockResolvedValue(baseRow({ draft_content: saved }));

    const result = await service.preview("note-1", actor);
    expect(result.previewSource).toBe("draft");
    expect(result.html.page1).toContain("SAVED_DB_TITLE");
    expect(result.html.page1).not.toContain("UNSAVED_LIVE_TITLE_XYZ");
  });

  it("preview and approval share the same HTML builder functions", async () => {
    const draft = buildCompleteProspectusReviewDraft();
    await service.previewUnsaved("note-1", { draftContent: draft }, actor);
    expect(mockBuildPageOneHtml).toHaveBeenCalled();
    expect(mockBuildPageTwoHtml).toHaveBeenCalled();
    expect(mockBuildPageThreeHtml).toHaveBeenCalled();
    expect(mockBuildPageOne).toHaveBeenCalled();
    expect(mockBuildPageTwo).toHaveBeenCalled();
    expect(mockBuildPageThree).toHaveBeenCalled();
  });
});
