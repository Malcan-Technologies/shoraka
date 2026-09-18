import { getIssuerFinancialTabYears } from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { financialStatementsV2Schema } from "./schemas";

/**
 * Initial SUBMIT only: stored financial_statements must still satisfy the live FYE window
 * and expected unaudited year keys. RESUBMIT must not call this.
 */
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
