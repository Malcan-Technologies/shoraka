jest.mock("../../lib/prisma", () => ({
  prisma: {},
}));

import type { BookMetrics } from "@cashsouk/types";
import { roundNoteMoney } from "@cashsouk/types";
import {
  assembleBookMetricHistory,
  bookMetricsHistoryQueryWindow,
  writeTodayBookMetricsSnapshot,
  type BookMetricsDailySnapshotRecord,
} from "./book-metrics-snapshot";

const today = new Date("2026-09-09T00:00:00.000Z");

function metric(amount: number, count: number) {
  return { amount, count };
}

function liveMetrics(overrides: Partial<BookMetrics> = {}): BookMetrics {
  return {
    outstanding: metric(1_250_000.004, 4),
    inFunding: metric(80_000, 2),
    distressed: metric(15_000, 1),
    arrears: metric(10_000, 1),
    defaulted: metric(5_000, 1),
    dueSoon: metric(40_000, 1),
    ...overrides,
  };
}

function snapshot(
  date: string,
  outstandingAmount: number,
  outstandingCount = 1
): BookMetricsDailySnapshotRecord {
  return {
    snapshotDate: new Date(`${date}T00:00:00.000Z`),
    outstanding: metric(outstandingAmount, outstandingCount),
    inFunding: metric(0, 0),
    arrears: metric(0, 0),
    defaulted: metric(0, 0),
    dueSoon: metric(0, 0),
  };
}

describe("assembleBookMetricHistory", () => {
  it("appends today's live metrics as the last point", () => {
    const live = liveMetrics();
    const history = assembleBookMetricHistory({
      snapshots: [snapshot("2026-09-08", 1_000_000, 3)],
      live,
      today,
    });

    expect(history).toHaveLength(2);
    expect(history[0]?.date).toBe("2026-09-08");
    expect(history[0]?.outstanding).toEqual({ amount: 1_000_000, count: 3 });
    expect(history.at(-1)).toEqual({
      date: "2026-09-09",
      outstanding: { amount: roundNoteMoney(1_250_000.004), count: 4 },
      inFunding: { amount: 80_000, count: 2 },
      arrears: { amount: 10_000, count: 1 },
      defaulted: { amount: 5_000, count: 1 },
      dueSoon: { amount: 40_000, count: 1 },
    });
  });

  it("keeps sparse snapshots without inventing missing days", () => {
    const history = assembleBookMetricHistory({
      snapshots: [snapshot("2026-08-29", 900_000), snapshot("2026-09-05", 950_000)],
      live: liveMetrics(),
      today,
    });

    expect(history.map((point) => point.date)).toEqual(["2026-08-29", "2026-09-05", "2026-09-09"]);
  });

  it("ignores a stored today row in favor of live metrics", () => {
    const live = liveMetrics({ outstanding: metric(2_000_000, 8) });
    const history = assembleBookMetricHistory({
      snapshots: [snapshot("2026-09-08", 1_000_000, 3), snapshot("2026-09-09", 50, 1)],
      live,
      today,
    });

    expect(history.map((point) => point.date)).toEqual(["2026-09-08", "2026-09-09"]);
    expect(history.at(-1)?.outstanding).toEqual({ amount: 2_000_000, count: 8 });
  });
});

describe("bookMetricsHistoryQueryWindow", () => {
  it("loads the previous 11 MYT calendar days and excludes today", () => {
    expect(bookMetricsHistoryQueryWindow(today)).toEqual({
      fromDate: new Date("2026-08-29T00:00:00.000Z"),
      toDate: new Date("2026-09-08T00:00:00.000Z"),
    });
  });
});

describe("writeTodayBookMetricsSnapshot", () => {
  it("upserts live getBookMetrics for the snapshot date", async () => {
    const live = liveMetrics();
    const repository = {
      getBookMetrics: jest.fn().mockResolvedValue(live),
      upsertBookMetricsDailySnapshot: jest.fn().mockResolvedValue(undefined),
    };

    await writeTodayBookMetricsSnapshot(today, repository);

    expect(repository.getBookMetrics).toHaveBeenCalledWith(undefined);
    expect(repository.upsertBookMetricsDailySnapshot).toHaveBeenCalledWith(today, live);
  });

  it("forwards the Malaysia midnight cutoff when labeling the closed day", async () => {
    const live = liveMetrics();
    const repository = {
      getBookMetrics: jest.fn().mockResolvedValue(live),
      upsertBookMetricsDailySnapshot: jest.fn().mockResolvedValue(undefined),
    };
    const cutoff = new Date("2026-09-08T16:00:00.000Z");

    await writeTodayBookMetricsSnapshot(today, repository, cutoff);

    expect(repository.getBookMetrics).toHaveBeenCalledWith(cutoff);
  });
});
