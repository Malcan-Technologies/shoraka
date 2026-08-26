import {
  invoiceDetailsNeedFinancingTenureCheck,
  parseFinancingTenureDays,
  validateFinancingTenureAgainstDueDate,
} from "@cashsouk/types";
import { AppError } from "./http/error-handler";

export function assertInvoiceFinancingTenure(
  details: Record<string, unknown>,
  referenceDate: Date = new Date(),
  options?: { required?: boolean; allowLegacyMissing?: boolean }
): void {
  const hasTenure = parseFinancingTenureDays(details.financing_tenure_days) != null;
  if (!options?.required && !invoiceDetailsNeedFinancingTenureCheck(details)) {
    return;
  }
  if (!options?.required && options?.allowLegacyMissing && !hasTenure) {
    return;
  }
  const result = validateFinancingTenureAgainstDueDate({
    tenureDays: details.financing_tenure_days,
    maturityDate: details.maturity_date ?? details.due_date,
    referenceDate,
  });
  if (!result.ok) {
    throw new AppError(400, "VALIDATION_ERROR", result.message);
  }
}

export function assertOfferFinancingTenure(
  tenureDays: unknown,
  details: Record<string, unknown>,
  referenceDate: Date = new Date()
): number {
  const result = validateFinancingTenureAgainstDueDate({
    tenureDays,
    maturityDate: details.maturity_date ?? details.due_date,
    referenceDate,
  });
  if (!result.ok) {
    throw new AppError(400, "VALIDATION_ERROR", result.message);
  }
  return result.tenureDays;
}
