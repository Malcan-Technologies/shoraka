/**
 * Product workflow limit readers and validators (invoice + contract steps).
 * Pure: no throwing, no React, no AppError.
 */

import { addMonths, differenceInMonths, isBefore, isValid, parseISO, startOfDay } from "date-fns";
import { getStepKeyFromStepId } from "./application-steps";
import { findInvoiceDetailsConfig, parsePositiveRmAmount } from "./invoice-details-config";
import { resolveInvoiceFinancingRatioBounds } from "./invoice-financing-ratio";
import { moneyAmountExceeds } from "./note-money";

export const PRODUCT_LIMIT_VIOLATION_CODE = "PRODUCT_LIMIT_VIOLATION";

export type ProductRuleCode =
  | "INVOICE_FACE_BELOW_MIN"
  | "INVOICE_FACE_ABOVE_MAX"
  | "FINANCING_BELOW_MIN"
  | "FINANCING_ABOVE_MAX"
  | "FINANCING_ABOVE_SUB_LIMIT"
  | "RATIO_BELOW_MIN"
  | "RATIO_ABOVE_MAX"
  | "CONTRACT_DURATION_TOO_SHORT";

export type ProductRuleField =
  | "invoice_value"
  | "financing_amount"
  | "financing_ratio_percent"
  | "end_date";

export interface ProductRuleViolation {
  code: ProductRuleCode;
  field: ProductRuleField;
  limit: number;
  actual: number;
  message: string;
}

export interface InvoiceProductRules {
  minInvoiceFaceValue: number | null;
  maxInvoiceFaceValue: number | null;
  minFinancingAmount: number | null;
  maxFinancingAmount: number | null;
  subLimitPerInvoiceRm: number | null;
  ratio: { min: number; max: number };
  minMonthsApplicationToMaturity: number | null;
  minMonthsReviewToMaturity: number | null;
}

export type ProductRuleMode = "issuer_request" | "admin_offer";

export interface ContractProductRules {
  minContractMonths: number | null;
}

const RATIO_COMPARE_EPSILON = 1e-9;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatProductRuleAmount(n: number): string {
  return `RM ${n.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Positive integer from a number or digit-only string. */
function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

function parseOptionalRatio(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function emptyInvoiceProductRules(): InvoiceProductRules {
  return {
    minInvoiceFaceValue: null,
    maxInvoiceFaceValue: null,
    minFinancingAmount: null,
    maxFinancingAmount: null,
    subLimitPerInvoiceRm: null,
    ratio: resolveInvoiceFinancingRatioBounds(null, null),
    minMonthsApplicationToMaturity: null,
    minMonthsReviewToMaturity: null,
  };
}

export function readInvoiceProductRules(workflow: unknown): InvoiceProductRules {
  const config = findInvoiceDetailsConfig(workflow);
  if (!config) return emptyInvoiceProductRules();
  return {
    minInvoiceFaceValue: parsePositiveRmAmount(config.min_invoice_face_value),
    maxInvoiceFaceValue: parsePositiveRmAmount(config.max_invoice_face_value),
    minFinancingAmount: parsePositiveRmAmount(config.min_invoice_value),
    maxFinancingAmount: parsePositiveRmAmount(config.max_invoice_value),
    subLimitPerInvoiceRm: parsePositiveRmAmount(config.sub_limit_per_invoice_rm),
    ratio: resolveInvoiceFinancingRatioBounds(
      parseOptionalRatio(config.min_financing_ratio_percent),
      parseOptionalRatio(config.max_financing_ratio_percent)
    ),
    minMonthsApplicationToMaturity: parsePositiveInteger(config.min_months_application_to_maturity),
    minMonthsReviewToMaturity: parsePositiveInteger(config.min_months_review_to_maturity),
  };
}

function isPositiveFiniteAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function collectFaceViolations(
  rules: InvoiceProductRules,
  invoiceFace: number
): ProductRuleViolation[] {
  if (!isPositiveFiniteAmount(invoiceFace)) return [];
  const out: ProductRuleViolation[] = [];
  if (rules.minInvoiceFaceValue != null && moneyAmountExceeds(rules.minInvoiceFaceValue, invoiceFace)) {
    out.push({
      code: "INVOICE_FACE_BELOW_MIN",
      field: "invoice_value",
      limit: rules.minInvoiceFaceValue,
      actual: invoiceFace,
      message: `Invoice value must be at least ${formatProductRuleAmount(rules.minInvoiceFaceValue)}.`,
    });
  }
  if (rules.maxInvoiceFaceValue != null && moneyAmountExceeds(invoiceFace, rules.maxInvoiceFaceValue)) {
    out.push({
      code: "INVOICE_FACE_ABOVE_MAX",
      field: "invoice_value",
      limit: rules.maxInvoiceFaceValue,
      actual: invoiceFace,
      message: `Invoice value cannot exceed ${formatProductRuleAmount(rules.maxInvoiceFaceValue)}.`,
    });
  }
  return out;
}

function financingAmountMessages(
  mode: ProductRuleMode,
  kind: "below_min" | "above_max" | "above_sub_limit",
  formatted: string
): string {
  if (mode === "admin_offer") {
    if (kind === "below_min") return `Offered financing must be at least ${formatted}.`;
    if (kind === "above_max") return `Offered financing cannot exceed ${formatted}.`;
    return `Offered financing cannot exceed the facility sub-limit of ${formatted} per invoice.`;
  }
  if (kind === "below_min") return `Financing amount must be at least ${formatted}.`;
  if (kind === "above_max") return `Financing amount cannot exceed ${formatted}.`;
  return `Financing amount cannot exceed the facility sub-limit of ${formatted} per invoice.`;
}

function collectFinancingViolations(
  rules: InvoiceProductRules,
  financingAmount: number,
  options: { mode: ProductRuleMode; hasFacility: boolean }
): ProductRuleViolation[] {
  if (!isPositiveFiniteAmount(financingAmount)) return [];
  const out: ProductRuleViolation[] = [];
  if (rules.minFinancingAmount != null && moneyAmountExceeds(rules.minFinancingAmount, financingAmount)) {
    out.push({
      code: "FINANCING_BELOW_MIN",
      field: "financing_amount",
      limit: rules.minFinancingAmount,
      actual: financingAmount,
      message: financingAmountMessages(
        options.mode,
        "below_min",
        formatProductRuleAmount(rules.minFinancingAmount)
      ),
    });
  }
  if (rules.maxFinancingAmount != null && moneyAmountExceeds(financingAmount, rules.maxFinancingAmount)) {
    out.push({
      code: "FINANCING_ABOVE_MAX",
      field: "financing_amount",
      limit: rules.maxFinancingAmount,
      actual: financingAmount,
      message: financingAmountMessages(
        options.mode,
        "above_max",
        formatProductRuleAmount(rules.maxFinancingAmount)
      ),
    });
  }
  if (
    options.hasFacility &&
    rules.subLimitPerInvoiceRm != null &&
    moneyAmountExceeds(financingAmount, rules.subLimitPerInvoiceRm)
  ) {
    out.push({
      code: "FINANCING_ABOVE_SUB_LIMIT",
      field: "financing_amount",
      limit: rules.subLimitPerInvoiceRm,
      actual: financingAmount,
      message: financingAmountMessages(
        options.mode,
        "above_sub_limit",
        formatProductRuleAmount(rules.subLimitPerInvoiceRm)
      ),
    });
  }
  return out;
}

function collectRatioViolations(
  rules: InvoiceProductRules,
  ratioPercent: number | null,
  mode: ProductRuleMode
): ProductRuleViolation[] {
  if (ratioPercent == null || !Number.isFinite(ratioPercent)) return [];
  const out: ProductRuleViolation[] = [];
  const noun = mode === "admin_offer" ? "Offered financing ratio" : "Financing ratio";
  if (ratioPercent + RATIO_COMPARE_EPSILON < rules.ratio.min) {
    out.push({
      code: "RATIO_BELOW_MIN",
      field: "financing_ratio_percent",
      limit: rules.ratio.min,
      actual: ratioPercent,
      message: `${noun} must be at least ${rules.ratio.min}%.`,
    });
  }
  if (ratioPercent > rules.ratio.max + RATIO_COMPARE_EPSILON) {
    out.push({
      code: "RATIO_ABOVE_MAX",
      field: "financing_ratio_percent",
      limit: rules.ratio.max,
      actual: ratioPercent,
      message: `${noun} cannot exceed ${rules.ratio.max}%.`,
    });
  }
  return out;
}

export function validateInvoiceAgainstProductRules(
  rules: InvoiceProductRules,
  input: { invoiceFace: number; financingAmount: number; ratioPercent: number | null },
  options: { mode: ProductRuleMode; hasFacility: boolean }
): ProductRuleViolation[] {
  return [
    ...collectFaceViolations(rules, input.invoiceFace),
    ...collectFinancingViolations(rules, input.financingAmount, options),
    ...collectRatioViolations(rules, input.ratioPercent, options.mode),
  ];
}

function findContractDetailsConfig(workflow: unknown): Record<string, unknown> | null {
  if (!Array.isArray(workflow)) return null;
  for (const step of workflow) {
    const sid = String((step as { id?: unknown })?.id ?? "");
    if (getStepKeyFromStepId(sid) !== "contract_details") continue;
    return asRecord((step as { config?: unknown }).config);
  }
  return null;
}

export function readContractProductRules(workflow: unknown): ContractProductRules {
  const config = findContractDetailsConfig(workflow);
  if (!config) return { minContractMonths: null };
  return {
    minContractMonths: parsePositiveInteger(config.min_contract_months ?? config.minContractMonths),
  };
}

function resolveContractBaseDate(
  startDate: Date | null,
  referenceDate?: Date | null
): Date | null {
  if (referenceDate != null && (startDate == null || referenceDate > startDate)) {
    return referenceDate;
  }
  return startDate;
}

function clampMonths(minMonths: number): number {
  return Math.min(120, Math.max(0, minMonths));
}

export function contractEndDateMeetsMinimumMonths(input: {
  startDate: Date | null;
  endDate: Date;
  minMonths: number | null;
  referenceDate?: Date | null;
}): boolean {
  const { startDate, endDate, minMonths, referenceDate } = input;
  if (minMonths == null || !Number.isFinite(minMonths) || minMonths <= 0) return true;
  const base = resolveContractBaseDate(startDate, referenceDate);
  if (base == null || !isValid(base) || !isValid(endDate)) return true;
  const minAllowed = addMonths(startOfDay(base), clampMonths(minMonths));
  return !isBefore(startOfDay(endDate), minAllowed);
}

export function validateContractAgainstProductRules(
  rules: ContractProductRules,
  input: { startDate: Date | null; endDate: Date | null; referenceDate?: Date | null }
): ProductRuleViolation[] {
  const { startDate, endDate, referenceDate } = input;
  if (endDate == null || !isValid(endDate)) return [];
  const minMonths = rules.minContractMonths;
  if (
    contractEndDateMeetsMinimumMonths({
      startDate,
      endDate,
      minMonths,
      referenceDate,
    })
  ) {
    return [];
  }
  if (minMonths == null) return [];
  const base = resolveContractBaseDate(startDate, referenceDate);
  const usedReference = base != null && referenceDate != null && base === referenceDate;
  const actual =
    base != null && isValid(base) ? differenceInMonths(startOfDay(endDate), startOfDay(base)) : 0;
  const after = usedReference ? "after today" : "after the start date";
  return [
    {
      code: "CONTRACT_DURATION_TOO_SHORT",
      field: "end_date",
      limit: minMonths,
      actual,
      message: `Facility end date must be at least ${minMonths} month(s) ${after}.`,
    },
  ];
}

export function firstProductRuleMessage(violations: ProductRuleViolation[]): string | null {
  return violations[0]?.message ?? null;
}

/**
 * User-facing message from an API error whose code is PRODUCT_LIMIT_VIOLATION.
 * Accepts the ApiError envelope (`{ error: { code, message } }`) or the inner error.
 */
export function readProductLimitViolationMessage(error: unknown): string | null {
  const record = asRecord(error);
  if (!record) return null;
  const inner = asRecord(record.error) ?? record;
  if (inner.code !== PRODUCT_LIMIT_VIOLATION_CODE) return null;
  return typeof inner.message === "string" && inner.message.trim() ? inner.message : null;
}

/** Parse invoice maturity from stored details (ISO yyyy-MM-dd or full ISO). */
export function parseInvoiceMaturityDate(value: string | undefined | null): Date | null {
  if (value == null || typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const iso = trimmed.length === 10 ? parseISO(`${trimmed}T00:00:00`) : parseISO(trimmed);
  if (!isValid(iso)) return null;
  return startOfDay(iso);
}

/** True if maturity is on or after addMonths(startOfDay(referenceDate), minMonths). */
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
