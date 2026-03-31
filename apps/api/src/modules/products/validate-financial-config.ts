/**
 * Validates product financial configuration before DB insert/update.
 * Prevents invalid configs (offer expiry, financing ratios) from corrupting the database.
 *
 * Invoice maturity helpers below align with @cashsouk/config offer-resolvers (parse / month rules).
 */

import { addMonths, isBefore, parseISO, startOfDay, isValid } from "date-fns";
import { AppError } from "../../lib/http/error-handler";

function getStepId(step: unknown): string {
  return (step as { id?: string })?.id ?? "";
}

function stepIdStartsWith(step: unknown, prefix: string): boolean {
  return getStepId(step).toLowerCase().startsWith(prefix);
}

/**
 * Mandatory step set: Financing Structure, Contract Details, Invoice Details.
 * Only applies when at least one of these steps is in the workflow.
 * When applicable: all three must be selected and in order.
 */
function validateMandatoryWorkflowStepSet(workflow: unknown[]): void {
  if (!Array.isArray(workflow) || workflow.length === 0) return;

  const fsIndex = workflow.findIndex((s) => stepIdStartsWith(s, "financing_structure"));
  const cdIndex = workflow.findIndex((s) => stepIdStartsWith(s, "contract_details"));
  const idIndex = workflow.findIndex((s) => stepIdStartsWith(s, "invoice_details"));

  const hasFs = fsIndex >= 0;
  const hasCd = cdIndex >= 0;
  const hasId = idIndex >= 0;

  /** Skip validation if none of these steps are in the workflow. */
  if (!hasFs && !hasCd && !hasId) {
    return;
  }

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

  const parseMonth = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
    if (typeof v === "string") {
      const n = parseInt(v.trim(), 10);
      return !Number.isNaN(n) ? n : null;
    }
    return null;
  };
  for (const v of [
    parseMonth(config.min_months_application_to_maturity),
    parseMonth(config.min_months_review_to_maturity),
  ]) {
    if (v != null && (v < 0 || v > 120)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid invoice maturity month configuration");
    }
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

// --- Invoice maturity (runtime checks; mirrors packages/config offer-resolvers) ---

export function parseInvoiceMaturityDate(value: string | undefined | null): Date | null {
  if (value == null || typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const iso = trimmed.length === 10 ? parseISO(`${trimmed}T00:00:00`) : parseISO(trimmed);
  if (!isValid(iso)) return null;
  return startOfDay(iso);
}

export function maturityMeetsMinimumMonthsFrom(
  maturityDate: Date,
  referenceDate: Date,
  minMonths: number | null | undefined
): boolean {
  if (minMonths == null || !Number.isFinite(minMonths) || minMonths <= 0) return true;
  const months = Math.min(120, Math.max(0, Math.floor(minMonths)));
  if (months === 0) return true;
  const minAllowed = addMonths(startOfDay(referenceDate), months);
  return !isBefore(startOfDay(maturityDate), minAllowed);
}

export function readInvoiceMaturityMonthsFromWorkflow(workflow: unknown): {
  minMonthsApplicationToMaturity: number | null;
  minMonthsReviewToMaturity: number | null;
} {
  const config = getInvoiceDetailsConfig(Array.isArray(workflow) ? workflow : []);
  if (!config) {
    return { minMonthsApplicationToMaturity: null, minMonthsReviewToMaturity: null };
  }
  const parse = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseInt(v, 10);
      return !Number.isNaN(n) ? n : null;
    }
    return null;
  };
  const application = parse(config.min_months_application_to_maturity);
  const review = parse(config.min_months_review_to_maturity);
  return {
    minMonthsApplicationToMaturity: application != null && application > 0 ? application : null,
    minMonthsReviewToMaturity: review != null && review > 0 ? review : null,
  };
}

function normalizeRefDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function assertMaturityForApplication(
  workflow: unknown,
  details: Record<string, unknown>,
  referenceDate: Date = new Date()
): void {
  const { minMonthsApplicationToMaturity } = readInvoiceMaturityMonthsFromWorkflow(workflow);
  if (minMonthsApplicationToMaturity == null) return;
  const raw = details.maturity_date ?? details.due_date;
  const maturity = parseInvoiceMaturityDate(typeof raw === "string" ? raw : undefined);
  if (!maturity) return;
  if (
    !maturityMeetsMinimumMonthsFrom(
      maturity,
      normalizeRefDay(referenceDate),
      minMonthsApplicationToMaturity
    )
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Invoice maturity must be at least ${minMonthsApplicationToMaturity} month(s) from today.`
    );
  }
}

export function assertMaturityForSendInvoiceOffer(
  workflow: unknown,
  details: Record<string, unknown>,
  referenceDate: Date = new Date()
): void {
  const { minMonthsReviewToMaturity } = readInvoiceMaturityMonthsFromWorkflow(workflow);
  if (minMonthsReviewToMaturity == null) return;
  const raw = details.maturity_date ?? details.due_date;
  const maturity = parseInvoiceMaturityDate(typeof raw === "string" ? raw : undefined);
  if (!maturity) {
    throw new AppError(400, "INVALID_STATE", "Invoice maturity date is missing");
  }
  if (!maturityMeetsMinimumMonthsFrom(maturity, normalizeRefDay(referenceDate), minMonthsReviewToMaturity)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Invoice maturity must be at least ${minMonthsReviewToMaturity} month(s) from today to send an offer.`
    );
  }
}
