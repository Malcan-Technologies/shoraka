/**
 * SECTION: RegTank formId normalization
 * WHY: RegTank expects a positive integer; env and JSON may be string, float, or invalid.
 */

import { AppError } from "../../lib/http/error-handler";

function positiveIntOrNull(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    const t = Math.trunc(value);
    if (t !== value) return null;
    return t;
  }
  const s = String(value).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number.parseInt(s, 10);
  return n > 0 ? n : null;
}

export function ensureRegTankFormId(value: unknown, defaultFormId: number): number {
  const d = positiveIntOrNull(defaultFormId);
  if (d === null) {
    throw new Error(`Invalid default RegTank formId: ${String(defaultFormId)}`);
  }
  return positiveIntOrNull(value) ?? d;
}

export function parseStrictRegTankFormId(value: unknown): number {
  const v = positiveIntOrNull(value);
  if (v === null) {
    throw new AppError(400, "INVALID_FORM_ID", "formId must be a positive integer");
  }
  return v;
}
