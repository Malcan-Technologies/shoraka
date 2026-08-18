/**
 * Validates product financial configuration before DB insert/update.
 * Prevents invalid configs (offer expiry, financing ratios) from corrupting the database.
 *
 * Invoice maturity helpers below align with @cashsouk/config offer-resolvers (parse / month rules).
 */

import { addMonths, isBefore, parseISO, startOfDay, isValid } from "date-fns";
import {
  ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY,
  ACCEPTANCE_DEADLINE_WORKFLOW_KEY,
  SIGNING_DEADLINE_WORKFLOW_KEY,
  assertPhaseDeadlineConfigValid,
  getStepKeyFromStepId,
  parsePhaseDeadlineConfig,
  parseSigningPackagesConfig,
  workflowUsesOfferAcceptanceFlow,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";

function getStepId(step: unknown): string {
  return (step as { id?: string })?.id ?? "";
}

function stepIdStartsWith(step: unknown, prefix: string): boolean {
  return getStepId(step).toLowerCase().startsWith(prefix);
}

/**
 * Mandatory step set: Financing Structure, Facility Details, Invoice Details.
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
      "Financing Structure, Facility Details, and Invoice Details must all be selected and appear in the correct order."
    );
  }
  if (fsIndex >= cdIndex || cdIndex >= idIndex) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Financing Structure, Facility Details, and Invoice Details must all be selected and appear in the correct order."
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
  if (step && typeof step === "object") {
    const config = (step as { config?: unknown }).config;
    if (config && typeof config === "object") {
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
  }

  if (!workflowUsesOfferAcceptanceFlow(workflow)) return;
  for (const stepRow of workflow) {
    const sid = (stepRow as { id?: string })?.id ?? "";
    if (getStepKeyFromStepId(sid) !== "financing_type") continue;
    const config = (stepRow as { config?: Record<string, unknown> }).config;
    if (!config || typeof config !== "object") return;
    if (parsePhaseDeadlineConfig(config[ACCEPTANCE_DEADLINE_WORKFLOW_KEY]) == null) {
      config[ACCEPTANCE_DEADLINE_WORKFLOW_KEY] = {
        days: 7,
        reminders: [{ days_before_expiry: 1 }],
      };
    }
    if (parsePhaseDeadlineConfig(config[SIGNING_DEADLINE_WORKFLOW_KEY]) == null) {
      config[SIGNING_DEADLINE_WORKFLOW_KEY] = {
        days: 14,
        reminders: [{ days_before_expiry: 3 }, { days_before_expiry: 1 }],
      };
    }
    return;
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

function supportingDocRowHasValidAllowedTypes(row: unknown): boolean {
  if (!row || typeof row !== "object") return true;
  const at = (row as Record<string, unknown>).allowed_types;
  if (at === undefined) return true;
  if (!Array.isArray(at)) return false;
  if (at.length === 0) return false;
  const tokens = at
    .filter((x): x is string => typeof x === "string")
    .filter((t) => t === "pdf" || t === "excel");
  const unique = [...new Set(tokens)];
  if (unique.length !== 1) return false;
  return true;
}

/**
 * Each supporting-doc row may omit allowed_types (pdf at runtime) or set exactly one
 * of pdf | excel.
 */
export function validateSupportingDocumentsConfig(workflow: unknown[]): void {
  if (!Array.isArray(workflow) || workflow.length === 0) return;
  for (const step of workflow) {
    const sid = (step as { id?: string })?.id ?? "";
    if (getStepKeyFromStepId(sid) !== "supporting_documents") continue;
    const config = (step as { config?: Record<string, unknown> }).config;
    if (!config || typeof config !== "object") return;
    for (const [key, value] of Object.entries(config)) {
      if (key === "enabled_categories") continue;
      if (!Array.isArray(value)) continue;
      for (let i = 0; i < value.length; i++) {
        const row = value[i];
        if (!supportingDocRowHasValidAllowedTypes(row)) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            `Supporting documents (${key}, row ${i + 1}): choose exactly one file type (PDF or Excel), not both.`
          );
        }
      }
    }
    return;
  }
}

export function validateAcceptanceDocumentsConfig(workflow: unknown[]): void {
  if (!Array.isArray(workflow) || workflow.length === 0) return;
  for (const step of workflow) {
    const sid = (step as { id?: string })?.id ?? "";
    if (getStepKeyFromStepId(sid) !== "financing_type") continue;
    const config = (step as { config?: Record<string, unknown> }).config;
    if (!config || typeof config !== "object") return;
    const list = config[ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY];
    if (list === undefined) return;
    if (!Array.isArray(list)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Acceptance documents must be an array."
      );
    }
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      const name =
        row && typeof row === "object" && typeof (row as { name?: unknown }).name === "string"
          ? String((row as { name: string }).name).trim()
          : "";
      if (!name) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          `Acceptance documents (row ${i + 1}): every document must have a name.`
        );
      }
      if (!supportingDocRowHasValidAllowedTypes(row)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          `Acceptance documents (row ${i + 1}): choose exactly one file type (PDF or Excel), not both.`
        );
      }
    }
    return;
  }
}

function findFinancingTypeConfig(workflow: unknown[]): Record<string, unknown> | null {
  for (const step of workflow) {
    const sid = (step as { id?: string })?.id ?? "";
    if (getStepKeyFromStepId(sid) !== "financing_type") continue;
    const config = (step as { config?: unknown }).config;
    return config && typeof config === "object" ? (config as Record<string, unknown>) : null;
  }
  return null;
}

function validateDeadlineField(
  config: Record<string, unknown>,
  key: string,
  label: string,
  required: boolean
): void {
  const raw = config[key];
  if (raw === undefined || raw === null) {
    if (required) {
      throw new AppError(400, "VALIDATION_ERROR", `${label} is required.`);
    }
    return;
  }
  const parsed = parsePhaseDeadlineConfig(raw);
  try {
    assertPhaseDeadlineConfigValid(parsed, label);
  } catch (err) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      err instanceof Error ? err.message : `${label} is invalid.`
    );
  }
}

/** Require acceptance/signing deadline configs when those flows are configured. */
export function validatePhaseDeadlineConfigs(workflow: unknown[]): void {
  if (!Array.isArray(workflow) || workflow.length === 0) return;
  const config = findFinancingTypeConfig(workflow);
  if (!config) return;

  const usesAcceptance = workflowUsesOfferAcceptanceFlow(workflow);
  validateDeadlineField(
    config,
    ACCEPTANCE_DEADLINE_WORKFLOW_KEY,
    "Acceptance deadline",
    usesAcceptance
  );

  const signing = parseSigningPackagesConfig(config);
  const signingEnabled = signing.enabled && signing.documents.length > 0;
  validateDeadlineField(
    config,
    SIGNING_DEADLINE_WORKFLOW_KEY,
    "Signing deadline",
    signingEnabled || usesAcceptance
  );
}

export const validateSupportingDocumentsAllowedTypes = validateSupportingDocumentsConfig;

export function validateBusinessDetailsGuarantorAgreement(workflow: unknown[]): void {
  if (!Array.isArray(workflow) || workflow.length === 0) return;
  for (const step of workflow) {
    const sid = (step as { id?: string })?.id ?? "";
    if (getStepKeyFromStepId(sid) !== "business_details") continue;
    const config = (step as { config?: Record<string, unknown> }).config;
    if (!config || typeof config !== "object") return;
    const row = config.guarantor_agreement ?? config.guarantor_agreement_template;
    if (!row || typeof row !== "object") return;
    if (config.guarantor_agreement && !supportingDocRowHasValidAllowedTypes(config.guarantor_agreement)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Guarantor agreement: choose exactly one file type (PDF or Excel), not both."
      );
    }
    return;
  }
}

/**
 * Full validation before product create/update.
 */
export function validateFinancialConfig(params: {
  workflow?: unknown[];
}): void {
  if (params.workflow && params.workflow.length > 0) {
    validateMandatoryWorkflowStepSet(params.workflow);
    validateWorkflowFinancialConfig(params.workflow);
    validateSupportingDocumentsConfig(params.workflow);
    validateAcceptanceDocumentsConfig(params.workflow);
    validatePhaseDeadlineConfigs(params.workflow);
    validateBusinessDetailsGuarantorAgreement(params.workflow);
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
