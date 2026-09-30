/**
 * SECTION: Note financial snapshot (copy of the approved Financial Review result)
 * WHY: Financial Review owns the review decision; the Note only carries it forward, and the
 * Prospectus reads it from the Note, never from the live application or CTOS
 */

import { parseApprovedFinancialResult, type ApprovedFinancialResult } from "@cashsouk/types";

export const NOTE_FINANCIAL_SNAPSHOT_VERSION = 2 as const;

export type NoteFinancialSnapshot = {
  version: typeof NOTE_FINANCIAL_SNAPSHOT_VERSION;
  /** Note creation time, ISO. */
  captured_at: string;
  /** The Financial Review result that was approved, copied without re-resolution. */
  approved_financial_result: ApprovedFinancialResult;
};

export function buildNoteFinancialSnapshot(
  result: ApprovedFinancialResult,
  capturedAt: Date
): NoteFinancialSnapshot {
  return {
    version: NOTE_FINANCIAL_SNAPSHOT_VERSION,
    captured_at: capturedAt.toISOString(),
    approved_financial_result: result,
  };
}

/** Returns null for a missing or malformed value; never throws. */
export function parseNoteFinancialSnapshot(value: unknown): NoteFinancialSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const root = value as Record<string, unknown>;
  if (root.version !== NOTE_FINANCIAL_SNAPSHOT_VERSION) return null;
  if (typeof root.captured_at !== "string" || Number.isNaN(Date.parse(root.captured_at))) {
    return null;
  }
  const approvedFinancialResult = parseApprovedFinancialResult(root.approved_financial_result);
  if (!approvedFinancialResult) return null;
  return {
    version: NOTE_FINANCIAL_SNAPSHOT_VERSION,
    captured_at: root.captured_at,
    approved_financial_result: approvedFinancialResult,
  };
}
