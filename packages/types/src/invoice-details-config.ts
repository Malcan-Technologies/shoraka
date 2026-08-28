/**
 * Product `invoice_details` step config readers.
 * Money fields are stored as numbers (raw RM), never preformatted "RM …" strings.
 */

import { getStepKeyFromStepId } from "./application-steps";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function findInvoiceDetailsConfig(workflow: unknown): Record<string, unknown> | null {
  if (!Array.isArray(workflow)) return null;
  for (const step of workflow) {
    const sid = String((step as { id?: unknown })?.id ?? "");
    if (getStepKeyFromStepId(sid) !== "invoice_details") continue;
    return asRecord((step as { config?: unknown }).config);
  }
  return null;
}

/** Positive finite RM amount from workflow JSON (number or numeric string). */
export function parsePositiveRmAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Frozen-product invoice sub-limit. Null when unset or not a positive amount. */
export function readInvoiceSubLimitPerInvoiceRmFromWorkflow(workflow: unknown): number | null {
  const config = findInvoiceDetailsConfig(workflow);
  if (!config) return null;
  return parsePositiveRmAmount(config.sub_limit_per_invoice_rm);
}
