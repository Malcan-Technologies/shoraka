/**
 * SECTION: Prospectus review status transitions (prisma mocked)
 */

import { NoteStatus, ProspectusReviewStatus } from "@prisma/client";
import { AppError } from "../../../lib/http/errors";
import { emptyProspectusReviewContent } from "./prospectus-review-content";
import { ProspectusReviewService } from "./prospectus-review.service";

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockTransaction = jest.fn();
const mockNoteFindUnique = jest.fn();
const mockAdminActionCreate = jest.fn();
const mockNoteEventCreate = jest.fn();

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    note: { findUnique: (...args: unknown[]) => mockNoteFindUnique(...args) },
    noteProspectusReview: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    noteAdminAction: { create: (...args: unknown[]) => mockAdminActionCreate(...args) },
    noteEvent: { create: (...args: unknown[]) => mockNoteEventCreate(...args) },
  },
}));

const actor = {
  userId: "admin-1",
  role: "ADMIN" as const,
  portal: "ADMIN" as const,
  ipAddress: "127.0.0.1",
  userAgent: "test",
  correlationId: "corr-1",
};

function completeDraft() {
  const draft = emptyProspectusReviewContent();
  draft.page1.keyInvestorHighlights = draft.page1.keyInvestorHighlights.map((h) => ({
    ...h,
    optionKey: "do_not_display",
    isVisible: false,
  }));
  draft.page1.paymentBasisOptionKey = "placeholder_bullet_maturity";
  draft.page1.shariahPrincipleOptionKey = "do_not_display";
  draft.page2.creditInsights = {
    creditScoreOptionKey: "positive",
    paymentBehaviourOptionKey: "neutral",
    creditUtilisationOptionKey: "do_not_display",
    litigationCheckOptionKey: "do_not_display",
    ccrisStatusOptionKey: "neutral",
  };
  draft.page2.invoiceWorkStatements = draft.page2.invoiceWorkStatements.map((s) => ({
    ...s,
    optionKey: "do_not_display",
    isVisible: false,
  }));
  draft.page3.investorTakeaways = {
    revenueProfitabilityOptionKey: "placeholder_positive",
    liquidityOptionKey: "do_not_display",
    leverageOptionKey: "placeholder_moderate",
    debtServicingCapacityOptionKey: "placeholder_adequate",
    workingCapitalEfficiencyOptionKey: "placeholder_typical",
    overallFinancialProfileOptionKey: "placeholder_balanced",
  };
  return draft;
}

function baseRow(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-07-19T10:00:00.000Z");
  return {
    id: "rev-1",
    note_id: "note-1",
    status: ProspectusReviewStatus.DRAFT,
    content_version: 1,
    option_catalogue_version: "2026.07.19.placeholder.v1",
    draft_content: completeDraft(),
    approved_content: null,
    created_by_user_id: "admin-1",
    updated_by_user_id: "admin-1",
    approved_by_user_id: null,
    approved_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("prospectus review transitions", () => {
  const service = new ProspectusReviewService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        noteProspectusReview: { update: mockUpdate },
        noteAdminAction: { create: mockAdminActionCreate },
        noteEvent: { create: mockNoteEventCreate },
      })
    );
    mockAdminActionCreate.mockResolvedValue({});
    mockNoteEventCreate.mockResolvedValue({});
  });

  it("submitForReview moves DRAFT → READY_FOR_REVIEW", async () => {
    const row = baseRow();
    mockFindUnique.mockResolvedValue(row);
    mockUpdate.mockResolvedValue({
      ...row,
      status: ProspectusReviewStatus.READY_FOR_REVIEW,
      content_version: 2,
    });

    const result = await service.submitForReview("note-1", actor);
    expect(result.status).toBe("READY_FOR_REVIEW");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("approve rejects DRAFT and accepts READY_FOR_REVIEW", async () => {
    mockFindUnique.mockResolvedValue(baseRow());
    await expect(service.approve("note-1", actor)).rejects.toMatchObject({
      code: "PROSPECTUS_REVIEW_NOT_READY",
    } satisfies Partial<AppError>);

    const ready = baseRow({ status: ProspectusReviewStatus.READY_FOR_REVIEW });
    mockFindUnique.mockResolvedValue(ready);
    mockUpdate.mockResolvedValue({
      ...ready,
      status: ProspectusReviewStatus.APPROVED,
      approved_content: ready.draft_content,
      approved_by_user_id: actor.userId,
      approved_at: new Date(),
      content_version: 3,
    });
    const approved = await service.approve("note-1", actor);
    expect(approved.status).toBe("APPROVED");
  });

  it("reopen allowed only for unpublished DRAFT Notes", async () => {
    mockNoteFindUnique.mockResolvedValue({
      status: NoteStatus.PUBLISHED,
      published_at: new Date(),
    });
    await expect(service.reopen("note-1", actor)).rejects.toMatchObject({
      code: "PROSPECTUS_REVIEW_REOPEN_FORBIDDEN",
    });

    mockNoteFindUnique.mockResolvedValue({
      status: NoteStatus.DRAFT,
      published_at: null,
    });
    const approved = baseRow({
      status: ProspectusReviewStatus.APPROVED,
      approved_content: completeDraft(),
      approved_by_user_id: "admin-1",
      approved_at: new Date(),
    });
    mockFindUnique.mockResolvedValue(approved);
    mockUpdate.mockResolvedValue({
      ...approved,
      status: ProspectusReviewStatus.DRAFT,
      content_version: 4,
    });
    const reopened = await service.reopen("note-1", actor);
    expect(reopened.status).toBe("DRAFT");
  });

  it("assertPublishAllowed blocks non-APPROVED statuses for new Notes", async () => {
    mockNoteFindUnique.mockResolvedValue({
      id: "note-1",
      created_at: new Date("2026-07-20T00:00:00.000Z"),
      prospectus_review: { id: "rev-1", status: ProspectusReviewStatus.DRAFT },
    });
    await expect(service.assertPublishAllowed("note-1")).rejects.toMatchObject({
      code: "PROSPECTUS_REVIEW_REQUIRED",
    });

    mockNoteFindUnique.mockResolvedValue({
      id: "note-1",
      created_at: new Date("2026-07-20T00:00:00.000Z"),
      prospectus_review: { id: "rev-1", status: ProspectusReviewStatus.READY_FOR_REVIEW },
    });
    await expect(service.assertPublishAllowed("note-1")).rejects.toMatchObject({
      code: "PROSPECTUS_REVIEW_REQUIRED",
    });

    mockNoteFindUnique.mockResolvedValue({
      id: "note-1",
      created_at: new Date("2026-07-20T00:00:00.000Z"),
      prospectus_review: { id: "rev-1", status: ProspectusReviewStatus.APPROVED },
    });
    await expect(service.assertPublishAllowed("note-1")).resolves.toBeUndefined();
  });

  it("assertPublishAllowed allows old Notes without a review row", async () => {
    mockNoteFindUnique.mockResolvedValue({
      id: "note-old",
      created_at: new Date("2026-07-01T00:00:00.000Z"),
      prospectus_review: null,
    });
    await expect(service.assertPublishAllowed("note-old")).resolves.toBeUndefined();
  });
});
