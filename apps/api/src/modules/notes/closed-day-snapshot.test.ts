import { DpdBucket, NoteServicingStatus, NoteSettlementStatus, NoteStatus } from "@prisma/client";
import {
  closedDaySnapshotStatuses,
  fundedAsOfCutoff,
  activatedAsOfCutoff,
  mytSnapshotCutoff,
  occurredBeforeCutoff,
  settlementsAsOfCutoff,
  waiversAsOfCutoff,
} from "./closed-day-snapshot";

const cutoff = new Date("2026-01-01T16:00:00.000Z");

function settlement(
  status: NoteSettlementStatus,
  postedAt: string | null,
  approvedAt?: string | null,
  updatedAt?: string | null
) {
  return {
    status,
    posted_at: postedAt ? new Date(postedAt) : null,
    approved_at: approvedAt ? new Date(approvedAt) : null,
    updated_at: updatedAt ? new Date(updatedAt) : null,
    tawidh_amount: 1,
    gharamah_amount: 2,
    investor_principal: 100,
    investor_profit_gross: 10,
  };
}

describe("mytSnapshotCutoff", () => {
  it("is Malaysia midnight of the current calendar day", () => {
    expect(mytSnapshotCutoff(new Date("2026-01-01T16:30:00.000Z")).toISOString()).toBe(
      "2026-01-01T16:00:00.000Z"
    );
  });
});

describe("settlementsAsOfCutoff", () => {
  it("keeps a settlement posted before the closed-day cutoff", () => {
    const { posted, applied } = settlementsAsOfCutoff(
      [settlement(NoteSettlementStatus.POSTED, "2026-01-01T15:50:00.000Z")],
      cutoff
    );
    expect(posted).toHaveLength(1);
    expect(applied).toHaveLength(1);
  });

  it("excludes a settlement posted between midnight and the 00:30 job", () => {
    const { posted, applied } = settlementsAsOfCutoff(
      [settlement(NoteSettlementStatus.POSTED, "2026-01-01T16:10:00.000Z")],
      cutoff
    );
    expect(posted).toHaveLength(0);
    expect(applied).toHaveLength(0);
  });

  it("keeps pre-cutoff approval in applied when posting happens after midnight", () => {
    const { posted, applied } = settlementsAsOfCutoff(
      [
        settlement(
          NoteSettlementStatus.POSTED,
          "2026-01-01T16:10:00.000Z",
          "2026-01-01T15:50:00.000Z"
        ),
      ],
      cutoff
    );
    expect(posted).toHaveLength(0);
    expect(applied).toHaveLength(1);
  });

  it("keeps an approved settlement that is still unposted at the cutoff", () => {
    const { posted, applied } = settlementsAsOfCutoff(
      [settlement(NoteSettlementStatus.APPROVED, null, "2026-01-01T15:50:00.000Z")],
      cutoff
    );
    expect(posted).toHaveLength(0);
    expect(applied).toHaveLength(1);
  });

  it("keeps a pre-cutoff approval that is voided after Malaysia midnight", () => {
    const { posted, applied } = settlementsAsOfCutoff(
      [
        settlement(
          NoteSettlementStatus.VOID,
          null,
          "2026-01-01T15:50:00.000Z",
          "2026-01-01T16:10:00.000Z"
        ),
      ],
      cutoff
    );
    expect(posted).toHaveLength(0);
    expect(applied).toHaveLength(1);
  });

  it("does not reconstruct a preview that was never approved", () => {
    const { applied } = settlementsAsOfCutoff(
      [
        settlement(
          NoteSettlementStatus.VOID,
          null,
          null,
          "2026-01-01T16:10:00.000Z"
        ),
      ],
      cutoff
    );
    expect(applied).toHaveLength(0);
  });

  it("excludes an approval that was already voided before the cutoff", () => {
    const { applied } = settlementsAsOfCutoff(
      [
        settlement(
          NoteSettlementStatus.VOID,
          null,
          "2026-01-01T15:50:00.000Z",
          "2026-01-01T15:55:00.000Z"
        ),
      ],
      cutoff
    );
    expect(applied).toHaveLength(0);
  });

  it("does not treat a same-morning approval as applied on the closed day", () => {
    const { posted, applied } = settlementsAsOfCutoff(
      [
        settlement(
          NoteSettlementStatus.POSTED,
          "2026-01-01T16:20:00.000Z",
          "2026-01-01T16:10:00.000Z"
        ),
      ],
      cutoff
    );
    expect(posted).toHaveLength(0);
    expect(applied).toHaveLength(0);
  });
});

describe("waiversAsOfCutoff", () => {
  it("drops waivers created after Malaysia midnight", () => {
    const kept = waiversAsOfCutoff(
      [
        { created_at: new Date("2026-01-01T15:00:00.000Z"), tawidh_waived_amount: 1, gharamah_waived_amount: 1 },
        { created_at: new Date("2026-01-01T16:10:00.000Z"), tawidh_waived_amount: 4, gharamah_waived_amount: 4 },
      ],
      cutoff
    );
    expect(kept).toHaveLength(1);
    expect(occurredBeforeCutoff(kept[0]?.created_at, cutoff)).toBe(true);
  });
});

describe("closedDaySnapshotStatuses", () => {
  const classification = {
    servicingStatus: NoteServicingStatus.ARREARS,
    noteStatus: NoteStatus.ARREARS,
    daysPastDue: 21,
    daysAfterGrace: 14,
    daysUntilDue: 0,
    dpdBucket: DpdBucket.DPD_1_30,
    isScDefault: false,
    indicativeTawidhAmount: 10,
    indicativeGharamahAmount: 40,
    dueDate: new Date("2025-12-11T00:00:00.000Z"),
  };

  it("keeps an after-cutoff settlement as an open arrears position on the closed day", () => {
    expect(
      closedDaySnapshotStatuses({
        repaidAsOfCutoff: false,
        postedAsOfCutoff: false,
        defaultedAsOfCutoff: false,
        classification,
        liveNoteStatus: NoteStatus.REPAID,
      })
    ).toEqual({
      daysPastDue: 21,
      servicingStatus: NoteServicingStatus.ARREARS,
      noteStatus: NoteStatus.ARREARS,
    });
  });

  it("does not close the note until repaid_at is before the cutoff", () => {
    expect(
      closedDaySnapshotStatuses({
        repaidAsOfCutoff: false,
        postedAsOfCutoff: false,
        defaultedAsOfCutoff: false,
        classification: {
          ...classification,
          servicingStatus: NoteServicingStatus.CURRENT,
          noteStatus: NoteStatus.ACTIVE,
          daysPastDue: 0,
        },
        liveNoteStatus: NoteStatus.ACTIVE,
      })
    ).toMatchObject({
      servicingStatus: NoteServicingStatus.CURRENT,
      noteStatus: NoteStatus.ACTIVE,
    });
    expect(
      closedDaySnapshotStatuses({
        repaidAsOfCutoff: false,
        postedAsOfCutoff: true,
        defaultedAsOfCutoff: false,
        classification,
        liveNoteStatus: NoteStatus.ACTIVE,
      })
    ).toEqual({
      daysPastDue: 0,
      servicingStatus: NoteServicingStatus.CURRENT,
      noteStatus: NoteStatus.ACTIVE,
    });
    expect(
      closedDaySnapshotStatuses({
        repaidAsOfCutoff: true,
        postedAsOfCutoff: true,
        defaultedAsOfCutoff: false,
        classification,
        liveNoteStatus: NoteStatus.REPAID,
      })
    ).toEqual({
      daysPastDue: 0,
      servicingStatus: NoteServicingStatus.SETTLED,
      noteStatus: NoteStatus.REPAID,
    });
  });

  it("does not stamp a same-morning default onto the closed day", () => {
    expect(
      closedDaySnapshotStatuses({
        repaidAsOfCutoff: false,
        postedAsOfCutoff: false,
        defaultedAsOfCutoff: false,
        classification,
        liveNoteStatus: NoteStatus.DEFAULTED,
      }).servicingStatus
    ).toBe(NoteServicingStatus.ARREARS);
  });

  it("keeps a late closed day as ACTIVE when default is marked after cutoff", () => {
    expect(
      closedDaySnapshotStatuses({
        repaidAsOfCutoff: false,
        postedAsOfCutoff: false,
        defaultedAsOfCutoff: false,
        classification: {
          ...classification,
          servicingStatus: NoteServicingStatus.LATE,
          noteStatus: null,
        },
        liveNoteStatus: NoteStatus.DEFAULTED,
      })
    ).toMatchObject({
      servicingStatus: NoteServicingStatus.LATE,
      noteStatus: NoteStatus.ACTIVE,
    });
  });
});

describe("fundedAsOfCutoff", () => {
  it("keeps legacy funded notes with no close timestamp", () => {
    expect(fundedAsOfCutoff(null, cutoff)).toBe(true);
  });

  it("excludes notes whose funding closed after Malaysia midnight", () => {
    expect(fundedAsOfCutoff(new Date("2026-01-01T16:10:00.000Z"), cutoff)).toBe(false);
    expect(fundedAsOfCutoff(new Date("2026-01-01T15:50:00.000Z"), cutoff)).toBe(true);
  });
});

describe("activatedAsOfCutoff", () => {
  it("keeps legacy notes with no activation timestamp", () => {
    expect(activatedAsOfCutoff(null, cutoff)).toBe(true);
  });

  it("excludes notes activated after Malaysia midnight", () => {
    expect(activatedAsOfCutoff(new Date("2026-01-01T16:10:00.000Z"), cutoff)).toBe(false);
    expect(activatedAsOfCutoff(new Date("2026-01-01T15:50:00.000Z"), cutoff)).toBe(true);
  });
});
