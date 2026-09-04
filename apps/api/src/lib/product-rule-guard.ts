import { isValid, parse, startOfDay } from "date-fns";
import {
  findInvoiceDetailsConfig,
  firstProductRuleMessage,
  parseInvoiceMaturityDate,
  PRODUCT_LIMIT_VIOLATION_CODE,
  readContractProductRules,
  readInvoiceProductRules,
  validateContractAgainstProductRules,
  validateInvoiceAgainstProductRules,
  type ProductRuleViolation,
} from "@cashsouk/types";
import { resolveInvoiceFaceValue, resolveRequestedInvoiceFinancing } from "./contract-facility";
import { AppError } from "./http/error-handler";

export type InvoiceProductRuleMode = "issuer_request" | "admin_offer";

export type AssertInvoiceProductRulesOptions = {
  mode: InvoiceProductRuleMode;
  hasFacility: boolean;
  offeredAmount?: number;
  offeredRatioPercent?: number | null;
};

function parseOptionalRatio(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function throwFirstProductViolation(violations: ProductRuleViolation[]): void {
  const first = violations[0];
  if (!first) return;
  throw new AppError(
    400,
    PRODUCT_LIMIT_VIOLATION_CODE,
    firstProductRuleMessage(violations) ?? first.message,
    { rule: first.code, field: first.field, limit: first.limit, actual: first.actual }
  );
}

function resolveIssuerRatio(details: Record<string, unknown> | null | undefined): number | null {
  return parseOptionalRatio(details?.financing_ratio_percent);
}

function resolveAdminOfferRatio(
  options: AssertInvoiceProductRulesOptions,
  invoiceFace: number
): number | null {
  if (options.offeredRatioPercent != null && Number.isFinite(options.offeredRatioPercent)) {
    return options.offeredRatioPercent;
  }
  const offered = options.offeredAmount;
  if (offered == null || !Number.isFinite(offered) || invoiceFace <= 0) return null;
  return (offered / invoiceFace) * 100;
}

export function assertInvoiceMeetsProductRules(
  workflow: unknown,
  details: Record<string, unknown> | null | undefined,
  options: AssertInvoiceProductRulesOptions
): void {
  if (!findInvoiceDetailsConfig(workflow)) return;
  const invoiceFace = resolveInvoiceFaceValue(details);
  const financingAmount =
    options.mode === "admin_offer"
      ? (options.offeredAmount ?? 0)
      : resolveRequestedInvoiceFinancing(details);
  const ratioPercent =
    options.mode === "admin_offer"
      ? resolveAdminOfferRatio(options, invoiceFace)
      : resolveIssuerRatio(details);
  throwFirstProductViolation(
    validateInvoiceAgainstProductRules(
      readInvoiceProductRules(workflow),
      { invoiceFace, financingAmount, ratioPercent },
      { mode: options.mode, hasFacility: options.hasFacility }
    )
  );
}

function parseContractRuleDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const iso = parseInvoiceMaturityDate(value);
  if (iso) return iso;
  const parsed = parse(value.trim(), "d/M/yyyy", new Date());
  return isValid(parsed) ? startOfDay(parsed) : null;
}

function asContractDetails(
  contractDetails: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  return contractDetails && typeof contractDetails === "object" && !Array.isArray(contractDetails)
    ? contractDetails
    : null;
}

export function assertContractMeetsProductRules(
  workflow: unknown,
  contractDetails: Record<string, unknown> | null | undefined,
  options?: { referenceDate?: Date | null }
): void {
  const details = asContractDetails(contractDetails);
  const startDate = parseContractRuleDate(details?.start_date);
  const endDate = parseContractRuleDate(details?.end_date);
  if (endDate && startDate && endDate.getTime() <= startDate.getTime()) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Facility end date must be after the start date."
    );
  }
  throwFirstProductViolation(
    validateContractAgainstProductRules(readContractProductRules(workflow), {
      startDate,
      endDate,
      referenceDate: options?.referenceDate,
    })
  );
}
