import {
  roundNoteMoney,
  type BookAmountMetric,
  type BookMetricHistoryPoint,
  type BookMetrics,
} from "@cashsouk/types";
import { calendarDateInTimeZone } from "../notes/servicing-classifier";
import { AdminRepository } from "./repository";

export const BOOK_METRICS_HISTORY_LOOKBACK_DAYS = 11;

export type BookMetricsSnapshotValues = {
  outstanding: BookAmountMetric;
  inFunding: BookAmountMetric;
  arrears: BookAmountMetric;
  defaulted: BookAmountMetric;
  dueSoon: BookAmountMetric;
};

export type BookMetricsDailySnapshotRecord = BookMetricsSnapshotValues & {
  snapshotDate: Date;
};

function roundMetric(metric: BookAmountMetric): BookAmountMetric {
  return { amount: roundNoteMoney(metric.amount), count: metric.count };
}

export function roundBookMetrics(metrics: BookMetrics): BookMetrics {
  return {
    outstanding: roundMetric(metrics.outstanding),
    inFunding: roundMetric(metrics.inFunding),
    distressed: roundMetric(metrics.distressed),
    arrears: roundMetric(metrics.arrears),
    defaulted: roundMetric(metrics.defaulted),
    dueSoon: roundMetric(metrics.dueSoon),
  };
}

export function mytCalendarDateKey(date: Date): string {
  return calendarDateInTimeZone(date).toISOString().slice(0, 10);
}

export function addUtcCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function bookMetricsHistoryQueryWindow(today: Date): { fromDate: Date; toDate: Date } {
  return {
    fromDate: addUtcCalendarDays(today, -BOOK_METRICS_HISTORY_LOOKBACK_DAYS),
    toDate: addUtcCalendarDays(today, -1),
  };
}

function toHistoryPoint(date: string, metrics: BookMetricsSnapshotValues): BookMetricHistoryPoint {
  return {
    date,
    outstanding: roundMetric(metrics.outstanding),
    inFunding: roundMetric(metrics.inFunding),
    arrears: roundMetric(metrics.arrears),
    defaulted: roundMetric(metrics.defaulted),
    dueSoon: roundMetric(metrics.dueSoon),
  };
}

export function assembleBookMetricHistory(input: {
  snapshots: BookMetricsDailySnapshotRecord[];
  live: BookMetrics;
  today: Date;
}): BookMetricHistoryPoint[] {
  const todayKey = mytCalendarDateKey(input.today);
  const history: BookMetricHistoryPoint[] = [];
  for (const snapshot of input.snapshots) {
    const date = mytCalendarDateKey(snapshot.snapshotDate);
    if (date === todayKey) continue;
    history.push(toHistoryPoint(date, snapshot));
  }
  history.push(toHistoryPoint(todayKey, input.live));
  return history;
}

export async function writeTodayBookMetricsSnapshot(
  snapshotDate: Date,
  repository: Pick<AdminRepository, "getBookMetrics" | "upsertBookMetricsDailySnapshot"> = new AdminRepository()
): Promise<void> {
  const metrics = await repository.getBookMetrics();
  await repository.upsertBookMetricsDailySnapshot(snapshotDate, metrics);
}
