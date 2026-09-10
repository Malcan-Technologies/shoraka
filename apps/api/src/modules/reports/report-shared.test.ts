import { mergeDefaultRecoverySnapshots } from "./report-shared";

type Snapshot = {
  note_id: string;
  snapshot_date: Date;
  outstanding_total: number;
};

describe("mergeDefaultRecoverySnapshots", () => {
  it("carries a settled default forward when later daily snapshots omit it", () => {
    const settled = {
      note_id: "settled-default",
      snapshot_date: new Date("2026-09-01T00:00:00.000Z"),
      outstanding_total: 0,
    };
    const open = {
      note_id: "open-default",
      snapshot_date: new Date("2026-09-09T00:00:00.000Z"),
      outstanding_total: 500,
    };

    expect(mergeDefaultRecoverySnapshots<Snapshot>([open], [settled])).toEqual([settled, open]);
  });

  it("prefers the exact-date snapshot and only carries the latest settled snapshot", () => {
    const exact = {
      note_id: "default-1",
      snapshot_date: new Date("2026-09-09T00:00:00.000Z"),
      outstanding_total: 0,
    };
    const earlierSettled = {
      ...exact,
      snapshot_date: new Date("2026-09-01T00:00:00.000Z"),
      outstanding_total: 10,
    };
    const laterSettled = {
      ...exact,
      snapshot_date: new Date("2026-09-02T00:00:00.000Z"),
      outstanding_total: 5,
    };

    expect(
      mergeDefaultRecoverySnapshots<Snapshot>([exact], [earlierSettled, laterSettled])
    ).toEqual([exact]);
  });
});
