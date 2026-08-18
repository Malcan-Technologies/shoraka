import {
  NoteFundingStatus,
  NoteListingStatus,
  NoteServicingStatus,
  NoteStatus,
  type NoteDetail,
} from "@cashsouk/types";
import {
  buildNoteLifecycleActionPlan,
  getNoteLifecycleCardTone,
  getNoteLifecycleStageCompletedAt,
  hasNoteLifecycleAdminAction,
} from "./note-lifecycle-actions";

function note(overrides: Partial<NoteDetail> = {}): NoteDetail {
  return {
    id: "note-1",
    noteReference: "NOTE-001",
    status: NoteStatus.DRAFT,
    listingStatus: NoteListingStatus.DRAFT,
    fundingStatus: NoteFundingStatus.NOT_OPEN,
    servicingStatus: NoteServicingStatus.NOT_STARTED,
    fundingPercent: 0,
    minimumFundingPercent: 80,
    investments: [],
    prospectus: {
      status: "APPROVED",
      displayStatus: "Approved",
      contentVersion: 1,
      lastSavedAt: null,
      approvedAt: new Date().toISOString(),
      publishedAt: null,
    },
    withdrawals: [],
    settlements: [],
    ...overrides,
  } as NoteDetail;
}

describe("published listing lifecycle actions", () => {
  const publishedOpen = {
    status: NoteStatus.PUBLISHED,
    listingStatus: NoteListingStatus.PUBLISHED,
    fundingStatus: NoteFundingStatus.OPEN,
    prospectus: {
      status: "PUBLISHED" as const,
      displayStatus: "Published",
      contentVersion: 1,
      lastSavedAt: null,
      approvedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    },
  };

  it("keeps Fail Funding supplementary and does not highlight as admin action", () => {
    const published = note({
      ...publishedOpen,
      fundingPercent: 10,
      investments: [{ id: "inv-1" }] as never,
    });
    const plan = buildNoteLifecycleActionPlan(published);

    expect(plan.primary).toBeNull();
    expect(plan.secondary).toEqual([
      expect.objectContaining({ key: "failFunding", variant: "secondary" }),
    ]);
    expect(plan.contextHelper).toContain("Awaiting investor commitments");
    expect(hasNoteLifecycleAdminAction(published)).toBe(false);
    expect(getNoteLifecycleCardTone(published)).toBe("waiting");
  });

  it("still treats Close Funding as the primary admin action", () => {
    const funded = note({
      ...publishedOpen,
      fundingPercent: 95,
      investments: [{ id: "inv-1" }] as never,
    });
    const plan = buildNoteLifecycleActionPlan(funded);

    expect(plan.primary?.key).toBe("closeFunding");
    expect(plan.secondary.some((action) => action.key === "failFunding")).toBe(false);
    expect(hasNoteLifecycleAdminAction(funded)).toBe(true);
    expect(getNoteLifecycleCardTone(funded)).toBe("action");
  });
});

describe("lifecycle stage completion dates", () => {
  it("reads first-class timestamps and disbursement completedAt", () => {
    const detail = note({
      createdAt: "2026-01-02T00:00:00.000Z",
      publishedAt: "2026-01-10T00:00:00.000Z",
      fundingClosedAt: "2026-02-01T00:00:00.000Z",
      activatedAt: "2026-02-03T00:00:00.000Z",
      repaidAt: "2026-05-01T00:00:00.000Z",
      withdrawals: [
        {
          withdrawalType: "ISSUER_DISBURSEMENT",
          status: "COMPLETED",
          completedAt: "2026-02-03T00:00:00.000Z",
        },
      ] as NoteDetail["withdrawals"],
    });

    expect(getNoteLifecycleStageCompletedAt(detail, "DRAFT")).toBe("2026-01-02T00:00:00.000Z");
    expect(getNoteLifecycleStageCompletedAt(detail, "PUBLISHED")).toBe("2026-01-10T00:00:00.000Z");
    expect(getNoteLifecycleStageCompletedAt(detail, "FUNDED")).toBe("2026-02-01T00:00:00.000Z");
    expect(getNoteLifecycleStageCompletedAt(detail, "DISBURSEMENT")).toBe("2026-02-03T00:00:00.000Z");
    expect(getNoteLifecycleStageCompletedAt(detail, "ACTIVE")).toBe("2026-02-03T00:00:00.000Z");
    expect(getNoteLifecycleStageCompletedAt(detail, "REPAID")).toBe("2026-05-01T00:00:00.000Z");
  });

  it("falls back to listing publish and close-funding events", () => {
    const detail = note({
      createdAt: "2026-01-02T00:00:00.000Z",
      publishedAt: null,
      fundingClosedAt: null,
      listing: { publishedAt: "2026-01-11T00:00:00.000Z" } as NoteDetail["listing"],
      events: [{ eventType: "CLOSE_FUNDING", createdAt: "2026-02-02T00:00:00.000Z" }] as NoteDetail["events"],
    });

    expect(getNoteLifecycleStageCompletedAt(detail, "PUBLISHED")).toBe("2026-01-11T00:00:00.000Z");
    expect(getNoteLifecycleStageCompletedAt(detail, "FUNDED")).toBe("2026-02-02T00:00:00.000Z");
    expect(getNoteLifecycleStageCompletedAt(detail, "DISBURSEMENT")).toBeNull();
    expect(getNoteLifecycleStageCompletedAt(detail, "REPAID")).toBeNull();
  });
});
