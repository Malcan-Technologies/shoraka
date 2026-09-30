/**
 * SECTION: Note financial snapshot (reviewed application financials copied at Note creation)
 * WHY: Prospectus reads these inputs from the Note, never from the live application or CTOS
 */

export const NOTE_FINANCIAL_SNAPSHOT_VERSION = 1 as const;

export type NoteFinancialSnapshot = {
  version: typeof NOTE_FINANCIAL_SNAPSHOT_VERSION;
  /** Note creation time, ISO. */
  captured_at: string;
  /** Year-selection reference date, ISO: application.submitted_at, else captured_at. */
  reference_date: string;
  /**
   * application.financial_statements verbatim: questionnaire, unaudited_by_year,
   * admin_input_by_year, admin_field_overrides.
   */
  financial_statements: unknown | null;
  /** Application-owned CTOS report, payload included. Null when the application owns none. */
  ctos: { report_id: string; fetched_at: string; financials: unknown | null } | null;
  source: {
    application_id: string;
    review_cycle: number | null;
    application_submitted_at: string | null;
    financial_review: {
      status: string | null;
      reviewed_at: string | null;
      reviewer_user_id: string | null;
    };
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function parseCtos(value: unknown): NoteFinancialSnapshot["ctos"] | undefined {
  if (value == null) return null;
  const ctos = asRecord(value);
  if (!ctos) return undefined;
  if (typeof ctos.report_id !== "string" || !isIsoDateTime(ctos.fetched_at)) return undefined;
  return {
    report_id: ctos.report_id,
    fetched_at: ctos.fetched_at,
    financials: ctos.financials ?? null,
  };
}

/** Returns null for a missing or malformed value; never throws. */
export function parseNoteFinancialSnapshot(value: unknown): NoteFinancialSnapshot | null {
  const root = asRecord(value);
  if (!root) return null;
  if (root.version !== NOTE_FINANCIAL_SNAPSHOT_VERSION) return null;
  if (!isIsoDateTime(root.captured_at) || !isIsoDateTime(root.reference_date)) return null;

  const ctos = parseCtos(root.ctos);
  if (ctos === undefined) return null;

  const source = asRecord(root.source);
  if (!source || typeof source.application_id !== "string") return null;
  const financialReview = asRecord(source.financial_review) ?? {};

  return {
    version: NOTE_FINANCIAL_SNAPSHOT_VERSION,
    captured_at: root.captured_at,
    reference_date: root.reference_date,
    financial_statements: root.financial_statements ?? null,
    ctos,
    source: {
      application_id: source.application_id,
      review_cycle: typeof source.review_cycle === "number" ? source.review_cycle : null,
      application_submitted_at: stringOrNull(source.application_submitted_at),
      financial_review: {
        status: stringOrNull(financialReview.status),
        reviewed_at: stringOrNull(financialReview.reviewed_at),
        reviewer_user_id: stringOrNull(financialReview.reviewer_user_id),
      },
    },
  };
}
