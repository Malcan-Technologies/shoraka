import {
  APPLICATION_COMREP_DETAIL_KEYS,
  APPLICATION_CORE_MONEY_KEYS,
  APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS,
  FINANCIAL_FIELD_LABELS,
  getIssuerFinancialTabYears,
  getStepKeyFromStepId,
  isIssuerFinancialFieldRequired,
  resolveAdminFinancialReviewColumns,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { financialStatementsV2Schema } from "./schemas";

export function isFinancialStatementsActiveWorkflowStep(workflow: unknown): boolean {
  if (!Array.isArray(workflow)) return false;
  for (const step of workflow) {
    const stepId =
      step && typeof step === "object" && "id" in step && typeof step.id === "string" ? step.id.trim() : "";
    if (!stepId) continue;
    if (getStepKeyFromStepId(stepId) === "financial_statements") return true;
  }
  return false;
}

/**
 * Initial SUBMIT only: stored financial_statements must still satisfy the live FYE window
 * and expected unaudited year keys. RESUBMIT must not call this.
 */
export function assertFinancialStatementsReadyForInitialSubmitIfActive(
  workflow: unknown,
  financialStatements: unknown,
  now: Date = new Date()
): void {
  if (!isFinancialStatementsActiveWorkflowStep(workflow)) return;
  if (financialStatements == null) return;
  assertFinancialStatementsReadyForInitialSubmit(financialStatements, now);
}

export function assertFinancialStatementsReadyForInitialSubmit(
  financialStatements: unknown,
  now: Date = new Date()
): void {
  const v2 = financialStatementsV2Schema.safeParse(financialStatements);
  if (!v2.success) {
    const message = v2.error.errors.map((e) => e.message).join("; ");
    throw new AppError(400, "VALIDATION_ERROR", `Financial Statements: ${message}`);
  }
  const expectedYears = getIssuerFinancialTabYears(v2.data.questionnaire, now);
  const actualKeys = Object.keys(v2.data.unaudited_by_year).sort();
  const expectedStr = expectedYears.map((y) => String(y)).sort();
  if (actualKeys.length !== expectedStr.length || actualKeys.some((k, i) => k !== expectedStr[i])) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Financial Statements: Unaudited years must match FYE rules: expected ${expectedStr.join(", ") || "(none)"}`
    );
  }
}

/**
 * Initial SUBMIT-time validation: enforce required raw financial inputs.
 *
 * This validates the resolved values (CTOS + issuer inputs + admin overrides),
 * so Admin can fill CTOS gaps without changing any formulas/prospectus logic.
 */
export function assertRequiredFinancialFieldsForInitialSubmit(params: {
  financialStatements: unknown;
  ctosFinancials: unknown;
  now?: Date;
}): void {
  const { financialStatements, ctosFinancials, now = new Date() } = params;
  const v2 = financialStatementsV2Schema.safeParse(financialStatements);
  if (!v2.success) {
    const message = v2.error.errors.map((e) => e.message).join("; ");
    throw new AppError(400, "VALIDATION_ERROR", `Financial Statements: ${message}`);
  }

  const expectedYears = getIssuerFinancialTabYears(v2.data.questionnaire, now);
  const columns = resolveAdminFinancialReviewColumns({
    financialStatements,
    ctosFinancials,
    ref: now,
    eligibleAdminInputYears: expectedYears,
  });

  const requiredKeys = [
    ...APPLICATION_CORE_MONEY_KEYS,
    ...APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS,
    ...APPLICATION_COMREP_DETAIL_KEYS,
  ].filter((k) => isIssuerFinancialFieldRequired(k)) as string[];

  const columnsByYear = new Map<number, (typeof columns)[number]>();
  for (const col of columns) columnsByYear.set(col.year, col);

  for (const year of expectedYears) {
    const col = columnsByYear.get(year);
    for (const key of requiredKeys) {
      const value = col?.fields?.[key]?.value ?? null;
      if (value == null) {
        const label = FINANCIAL_FIELD_LABELS[key] ?? key;
        throw new AppError(400, "VALIDATION_ERROR", `${label} is required.`);
      }
    }
  }
}
