/**
 * Validates product financial configuration before DB insert/update.
 * Prevents invalid configs (offer expiry, financing ratios) from corrupting the database.
 */

import { AppError } from "../../lib/http/error-handler";

function getStepId(step: unknown): string {
  return (step as { id?: string })?.id ?? "";
}

function stepIdStartsWith(step: unknown, prefix: string): boolean {
  return getStepId(step).toLowerCase().startsWith(prefix);
}

/** Mandatory step set: Financing Structure, Contract Details, Invoice Details. All three must be selected and in order. */
function validateMandatoryWorkflowStepSet(workflow: unknown[]): void {
  if (!Array.isArray(workflow) || workflow.length === 0) return;

  const fsIndex = workflow.findIndex((s) => stepIdStartsWith(s, "financing_structure"));
  const cdIndex = workflow.findIndex((s) => stepIdStartsWith(s, "contract_details"));
  const idIndex = workflow.findIndex((s) => stepIdStartsWith(s, "invoice_details"));

  const hasFs = fsIndex >= 0;
  const hasCd = cdIndex >= 0;
  const hasId = idIndex >= 0;

  if (!hasFs || !hasCd || !hasId) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Financing Structure, Contract Details, and Invoice Details must all be selected and appear in the correct order."
    );
  }
  if (fsIndex >= cdIndex || cdIndex >= idIndex) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Financing Structure, Contract Details, and Invoice Details must all be selected and appear in the correct order."
    );
  }
}

function getInvoiceDetailsConfig(workflow: unknown[]): Record<string, unknown> | null {
  const step = workflow.find((s) => stepIdStartsWith(s, "invoice_details"));
  if (!step) return null;
  const config = (step as { config?: unknown }).config;
  return config && typeof config === "object" ? (config as Record<string, unknown>) : null;
}

const DEFAULT_MIN_FINANCING_RATIO = 60;
const DEFAULT_MAX_FINANCING_RATIO = 80;

/**
 * Apply default financing ratios when missing. Mutates workflow in place.
 * min_financing_ratio_percent = 60, max_financing_ratio_percent = 80 when absent.
 */
export function applyFinancialDefaults(workflow: unknown[]): void {
  if (!Array.isArray(workflow) || workflow.length === 0) return;
  const step = workflow.find((s) => stepIdStartsWith(s, "invoice_details"));
  if (!step || typeof step !== "object") return;
  const config = (step as { config?: unknown }).config;
  if (!config || typeof config !== "object") return;
  const c = config as Record<string, unknown>;
  const toNum = (v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string") {
      const n = parseInt(v, 10);
      return !Number.isNaN(n) ? n : null;
    }
    return null;
  };
  if (toNum(c.min_financing_ratio_percent) == null) {
    c.min_financing_ratio_percent = DEFAULT_MIN_FINANCING_RATIO;
  }
  if (toNum(c.max_financing_ratio_percent) == null) {
    c.max_financing_ratio_percent = DEFAULT_MAX_FINANCING_RATIO;
  }
}

/**
 * Validate offer_expiry_days when provided.
 * Must be integer > 0.
 */
export function validateOfferExpiry(offerExpiryDays: number | null | undefined): void {
  if (offerExpiryDays == null) return;
  if (!Number.isInteger(offerExpiryDays) || offerExpiryDays <= 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Offer expiry must be greater than 0");
  }
}

/**
 * Validate invoice_details financing ratio config from workflow.
 * min_financing_ratio_percent >= 0, max_financing_ratio_percent <= 100, min <= max.
 */
export function validateWorkflowFinancialConfig(workflow: unknown[]): void {
  const config = getInvoiceDetailsConfig(Array.isArray(workflow) ? workflow : []);
  if (!config) return;

  const toNum = (v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string") {
      const n = parseInt(v, 10);
      return !Number.isNaN(n) ? n : null;
    }
    return null;
  };

  const minRatio = toNum(config.min_financing_ratio_percent);
  const maxRatio = toNum(config.max_financing_ratio_percent);

  if (minRatio != null && minRatio < 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid financing ratio configuration");
  }
  if (maxRatio != null && maxRatio > 100) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid financing ratio configuration");
  }
  if (minRatio != null && maxRatio != null && minRatio > maxRatio) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid financing ratio configuration");
  }
}

/**
 * Full validation before product create/update.
 */
export function validateFinancialConfig(params: {
  workflow?: unknown[];
  offer_expiry_days?: number | null;
}): void {
  validateOfferExpiry(params.offer_expiry_days);
  if (params.workflow && params.workflow.length > 0) {
    validateMandatoryWorkflowStepSet(params.workflow);
    validateWorkflowFinancialConfig(params.workflow);
  }
}
