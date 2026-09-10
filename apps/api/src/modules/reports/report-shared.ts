import {
  addMytCalendarDays,
  inclusiveRangePostedAtFilter,
  mytStartOfDayUtc,
  REPORT_REGISTRY,
  roundNoteMoney,
  type ReportKey,
  type ReportQuery,
} from "@cashsouk/types";
import { NoteFundingStatus, NoteServicingStatus, Prisma } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { calendarDateInTimeZone } from "../notes/servicing-classifier";

export function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function issuerName(snapshot: Prisma.JsonValue | null): string {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return "—";
  const record = snapshot as Record<string, unknown>;
  const name = record.companyName ?? record.legal_name ?? record.name;
  return typeof name === "string" && name.trim() ? name : "—";
}

export function snapshotName(snapshot: Prisma.JsonValue | null, keys: string[]): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const record = snapshot as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function isToday(asOf?: string): boolean {
  if (!asOf) return true;
  return asOf === calendarDateInTimeZone(new Date()).toISOString().slice(0, 10);
}

export function parseAsOf(asOf?: string): Date {
  const iso = asOf ?? calendarDateInTimeZone(new Date()).toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

export function reportDefinition(key: ReportKey) {
  const report = REPORT_REGISTRY.find((item) => item.key === key);
  if (!report) throw new AppError(404, "REPORT_NOT_FOUND", "Report not found");
  return report;
}

export function postedAtRange(query: Pick<ReportQuery, "from" | "to">) {
  return inclusiveRangePostedAtFilter(query.from, query.to);
}

/** Exclusive UTC instant after the last MYT instant of YYYY-MM-DD. */
export function exclusiveEndOfMytDateLabel(asOfLabel: string): Date {
  const [year = 0, month = 0, day = 0] = asOfLabel.split("-").map(Number);
  return mytStartOfDayUtc(addMytCalendarDays({ year, month, day }, 1));
}

export function defaultedNoteWhere(asOfExclusiveEnd?: Date) {
  if (!asOfExclusiveEnd) return { default_marked_at: { not: null } };
  return { default_marked_at: { not: null, lt: asOfExclusiveEnd } };
}

export function roundMoney(value: number): number {
  return roundNoteMoney(value);
}

export function percentOf(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

export function liveOpenBookNoteWhere(): Prisma.NoteWhereInput {
  return {
    funding_status: NoteFundingStatus.FUNDED,
    activated_at: { not: null },
    servicing_status: { not: NoteServicingStatus.SETTLED },
  };
}

export function openBookSnapshots<T extends { servicing_status: string }>(snapshots: T[]): T[] {
  return snapshots.filter((snapshot) => snapshot.servicing_status !== "SETTLED");
}

export function mergeDefaultRecoverySnapshots<T extends { note_id: string; snapshot_date: Date }>(
  exactDateSnapshots: T[],
  settledSnapshots: T[]
): T[] {
  const byNote = new Map<string, T>();
  for (const snapshot of settledSnapshots) {
    const existing = byNote.get(snapshot.note_id);
    if (!existing || existing.snapshot_date < snapshot.snapshot_date) {
      byNote.set(snapshot.note_id, snapshot);
    }
  }
  for (const snapshot of exactDateSnapshots) {
    byNote.set(snapshot.note_id, snapshot);
  }
  return [...byNote.values()];
}

export function jsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function assertReportQuery(key: ReportKey, query: ReportQuery) {
  if (Boolean(query.from) !== Boolean(query.to)) {
    throw new AppError(400, "VALIDATION_ERROR", "From and to must be provided together.");
  }
  const definition = REPORT_REGISTRY.find((item) => item.key === key);
  if (definition?.filters.includes("from") && (!query.from || !query.to)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "From and to are required for range reports."
    );
  }
  if (query.from && query.to && query.from > query.to) {
    throw new AppError(400, "VALIDATION_ERROR", "From must be on or before to.");
  }
  if (query.groupBy && key !== "portfolio_composition") {
    throw new AppError(400, "VALIDATION_ERROR", "Breakdown applies only to Portfolio composition.");
  }
}
