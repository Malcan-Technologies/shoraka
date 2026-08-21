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
  getNoteLifecycleStageIndex,
  getNoteLifecycleTerminalFailure,
  hasNoteLifecycleAdminAction,
  isNoteFeatureEligible,
  isNoteSettlementStageCurrent,
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
  const publishedOpen: Partial<NoteDetail> = {
    status: NoteStatus.PUBLISHED,
    listingStatus: NoteListingStatus.PUBLISHED,
    fundingStatus: NoteFundingStatus.OPEN,
    prospectus: {
      status: "PUBLISHED",
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
      expect.objectContaining({ key: "pauseListing", variant: "outline" }),
    ]);
    expect(plan.contextHelper).toContain("Awaiting investor commitments");
    expect(hasNoteLifecycleAdminAction(published)).toBe(false);
    expect(getNoteLifecycleCardTone(published)).toBe("waiting");
  });

  it("offers Pause campaign while funding is open with commitments", () => {
    const published = note({
      ...publishedOpen,
      fundingPercent: 10,
      investments: [{ id: "inv-1" }] as never,
    });
    const plan = buildNoteLifecycleActionPlan(published);

    expect(plan.isListingLive).toBe(true);
    expect(plan.isListingPaused).toBe(false);
    expect(plan.secondary.some((action) => action.key === "pauseListing")).toBe(true);
    expect(plan.secondary.some((action) => action.key === "unpublish")).toBe(false);
  });

  it("offers Resume campaign when the listing is paused and holds funds", () => {
    const paused = note({
      ...publishedOpen,
      listingStatus: NoteListingStatus.UNPUBLISHED,
      fundingPercent: 10,
      investments: [{ id: "inv-1" }] as never,
    });
    const plan = buildNoteLifecycleActionPlan(paused);

    expect(plan.isListingLive).toBe(false);
    expect(plan.isListingPaused).toBe(true);
    expect(plan.primary?.key).toBe("resumeListing");
    expect(plan.secondary).toEqual([
      expect.objectContaining({ key: "failFunding", variant: "secondary" }),
    ]);
    expect(plan.contextHelper).toContain("funds have not been returned");
    expect(hasNoteLifecycleAdminAction(paused)).toBe(false);
    expect(isNoteFeatureEligible(paused)).toBe(false);
  });

  it("still treats Close Funding as the primary admin action", () => {
    const funded = note({
      ...publishedOpen,
      fundingPercent: 95,
      investments: [{ id: "inv-1" }] as never,
    });
    const plan = buildNoteLifecycleActionPlan(funded);

    expect(plan.primary?.key).toBe("closeFunding");
    expect(plan.secondary).toEqual([
      expect.objectContaining({ key: "pauseListing", variant: "outline" }),
    ]);
    expect(plan.secondary.some((action) => action.key === "failFunding")).toBe(false);
    expect(hasNoteLifecycleAdminAction(funded)).toBe(true);
    expect(getNoteLifecycleCardTone(funded)).toBe("action");
  });

  it("keeps Close Funding primary while a funded campaign is paused", () => {
    const pausedFunded = note({
      ...publishedOpen,
      listingStatus: NoteListingStatus.UNPUBLISHED,
      fundingPercent: 95,
      investments: [{ id: "inv-1" }] as never,
    });
    const plan = buildNoteLifecycleActionPlan(pausedFunded);

    expect(plan.primary?.key).toBe("closeFunding");
    expect(plan.secondary).toEqual([
      expect.objectContaining({ key: "resumeListing", variant: "outline" }),
    ]);
    expect(hasNoteLifecycleAdminAction(pausedFunded)).toBe(true);
  });

  it("allows featuring only while published and open for funding", () => {
    expect(isNoteFeatureEligible(note(publishedOpen))).toBe(true);
    expect(
      isNoteFeatureEligible(
        note({
          ...publishedOpen,
          fundingStatus: NoteFundingStatus.FUNDED,
        })
      )
    ).toBe(false);
    expect(isNoteFeatureEligible(note())).toBe(false);
  });

  it("keeps Unpublish for open listings with no commitments", () => {
    const empty = note({
      ...publishedOpen,
      fundingPercent: 0,
      investments: [],
    });
    const plan = buildNoteLifecycleActionPlan(empty);

    expect(plan.secondary.some((action) => action.key === "unpublish")).toBe(true);
    expect(plan.secondary.some((action) => action.key === "pauseListing")).toBe(false);
  });

  it("does not offer Publish after unpublish until the prospectus is re-approved", () => {
    const unpublished = note({
      status: NoteStatus.DRAFT,
      listingStatus: NoteListingStatus.UNPUBLISHED,
      fundingStatus: NoteFundingStatus.NOT_OPEN,
      prospectus: {
        status: "PUBLISHED",
        displayStatus: "Draft",
        contentVersion: 5,
        lastSavedAt: null,
        approvedAt: new Date().toISOString(),
        publishedAt: null,
      },
    });
    const plan = buildNoteLifecycleActionPlan(unpublished);
    expect(plan.primary).toBeNull();
    expect(plan.primary?.key).not.toBe("publish");
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
    expect(getNoteLifecycleStageCompletedAt(detail, "SETTLEMENT")).toBeNull();
    expect(getNoteLifecycleStageCompletedAt(detail, "REPAID")).toBe("2026-05-01T00:00:00.000Z");
  });

  it("reads settlement from the first posted settlement timestamp", () => {
    const detail = note({
      settlements: [
        {
          status: "POSTED",
          postedAt: "2026-04-20T00:00:00.000Z",
        },
        {
          status: "POSTED",
          postedAt: "2026-04-10T00:00:00.000Z",
        },
      ] as NoteDetail["settlements"],
    });

    expect(getNoteLifecycleStageCompletedAt(detail, "SETTLEMENT")).toBe("2026-04-10T00:00:00.000Z");
  });

  it("treats posted or wrapping settlement as the current stage before Complete", () => {
    const active = note({
      status: NoteStatus.ACTIVE,
      servicingStatus: NoteServicingStatus.CURRENT,
      fundingStatus: NoteFundingStatus.FUNDED,
    });
    expect(getNoteLifecycleStageIndex(active)).toBe(4);
    expect(isNoteSettlementStageCurrent(active)).toBe(false);

    const settling = note({
      status: NoteStatus.ACTIVE,
      servicingStatus: NoteServicingStatus.CURRENT,
      fundingStatus: NoteFundingStatus.FUNDED,
      settlements: [{ status: "PREVIEW" }] as NoteDetail["settlements"],
    });
    expect(isNoteSettlementStageCurrent(settling)).toBe(true);
    expect(getNoteLifecycleStageIndex(settling)).toBe(5);

    const complete = note({
      status: NoteStatus.REPAID,
      servicingStatus: NoteServicingStatus.SETTLED,
    });
    expect(getNoteLifecycleStageIndex(complete)).toBe(6);
  });

  it("marks defaulted on Settlement when settlement work has started", () => {
    const defaulted = note({
      status: NoteStatus.DEFAULTED,
      servicingStatus: NoteServicingStatus.DEFAULTED,
      fundingStatus: NoteFundingStatus.FUNDED,
    });
    expect(getNoteLifecycleStageIndex(defaulted)).toBe(4);
    expect(getNoteLifecycleTerminalFailure(defaulted, 4)?.stageIndex).toBe(4);

    const defaultedSettling = note({
      status: NoteStatus.DEFAULTED,
      servicingStatus: NoteServicingStatus.DEFAULTED,
      fundingStatus: NoteFundingStatus.FUNDED,
      settlements: [{ status: "POSTED", postedAt: "2026-04-10T00:00:00.000Z" }] as NoteDetail["settlements"],
    });
    expect(getNoteLifecycleStageIndex(defaultedSettling)).toBe(5);
    expect(getNoteLifecycleTerminalFailure(defaultedSettling, 5)?.stageIndex).toBe(5);
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
