import {
  getFinancialYearEndValidationError,
  normalizeFinancialStatementsQuestionnaire,
  parseFinancialStatementsQuestionnaireShape,
  type FinancialYearEndValidationError,
} from "@cashsouk/types";
import { format, isValid, parse, parseISO, startOfDay } from "date-fns";

/**
 * Application-flow date rules (aligned with contract-details-step).
 * `DateInput` emits `d/M/yyyy` (e.g. calendar → `05/03/2026`). API / DB use ISO `yyyy-MM-dd`.
 * Only these shapes are accepted — no extra formats elsewhere in the flow.
 */
export function parseApplicationFlowDate(dateStr?: string | null): Date | null {
  if (!dateStr || !String(dateStr).trim()) return null;
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = parseISO(s);
    return isValid(d) ? d : null;
  }
  const d = parse(s, "d/M/yyyy", new Date());
  return isValid(d) ? d : null;
}

export function isApplicationFlowDateValid(dateStr?: string | null): boolean {
  return parseApplicationFlowDate(dateStr) != null;
}

export function applicationFlowDateToIso(dateStr?: string | null): string | null {
  const d = parseApplicationFlowDate(dateStr);
  return d ? format(d, "yyyy-MM-dd") : null;
}

/** Calendar-day comparison in local time (issuer “last closing” must not be after today). */
export function isApplicationFlowDateOnOrBeforeToday(dateStr?: string | null): boolean {
  const iso = applicationFlowDateToIso(dateStr);
  if (!iso) return false;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const chosen = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!isValid(chosen)) return false;
  return startOfDay(chosen).getTime() <= startOfDay(new Date()).getTime();
}

/** Next FYE: display `d/M/yyyy` (or ISO) → shared window codes. */
export function getApplicationFlowFinancialYearEndError(
  dateStr?: string | null
): FinancialYearEndValidationError | null {
  if (!dateStr || !String(dateStr).trim()) return "invalid";
  const iso = applicationFlowDateToIso(dateStr);
  if (!iso) return "invalid";
  return getFinancialYearEndValidationError(iso);
}

/** Numeric FY keys from stored `formsByYear` / `unaudited_by_year`, oldest → newest. */
export function storedFinancialFormYears(
  formsByYear: Record<string, unknown> | null | undefined
): number[] {
  if (!formsByYear || typeof formsByYear !== "object" || Array.isArray(formsByYear)) return [];
  const years: number[] = [];
  for (const key of Object.keys(formsByYear)) {
    const n = Number(key);
    if (Number.isInteger(n)) years.push(n);
  }
  return years.sort((a, b) => a - b);
}

/**
 * New-application org history may seed the FYE picker only when the date is still inside
 * the live window. Shape-only fallback is reserved for existing saved drafts and readOnly.
 */
export function newApplicationOrgPrefillFinancialYearEnd(
  questionnaire: unknown,
  ref: Date = new Date()
): string {
  return normalizeFinancialStatementsQuestionnaire(questionnaire, ref)?.financial_year_end ?? "";
}

/**
 * Dirty check for a displayed FYE against a shape-only snapshot (no today-relative normalize).
 * Used when the live window rejects the current date so a full payload cannot be compared.
 */
export function isFinancialYearEndDisplayDirtyAgainstSnapshot(
  currentIso: string | null,
  snapshotQuestionnaire: unknown
): boolean {
  const shape = parseFinancialStatementsQuestionnaireShape(snapshotQuestionnaire);
  const snapshotFye = shape?.financial_year_end ?? "";
  return (currentIso ?? "") !== snapshotFye;
}

/** Hydrate `DateInput` from API: ISO → display `d/M/yyyy`. */
export function isoToApplicationFlowDateDisplay(raw?: string | null): string {
  if (!raw) return "";
  try {
    const p = parseISO(raw);
    if (isValid(p)) return format(p, "d/M/yyyy");
  } catch {
    /* fallthrough */
  }
  try {
    const p2 = parse(raw, "d/M/yyyy", new Date());
    if (isValid(p2)) return format(p2, "d/M/yyyy");
  } catch {
    /* ignore */
  }
  return raw;
}
