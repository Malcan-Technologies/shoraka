import { format, isValid, parse, parseISO } from "date-fns";

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
