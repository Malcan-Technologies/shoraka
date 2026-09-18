import {
  getIssuerFinancialTabYears,
  type FinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import { storedFinancialFormYears } from "./application-flow-dates";

/**
 * Live FYE window drives editable tabs. Stored form keys are used when readOnly
 * or when amendment keeps the submitted FYE (which may now sit outside the window).
 */
export function resolveIssuerFinancialYearsToShow(params: {
  readOnly: boolean;
  preserveStoredYears?: boolean;
  formsByYear: Record<string, unknown> | null | undefined;
  questionnaire: FinancialStatementsQuestionnaire | null;
  ref?: Date;
}): number[] {
  if (params.readOnly || params.preserveStoredYears) return storedFinancialFormYears(params.formsByYear);
  if (!params.questionnaire) return [];
  return getIssuerFinancialTabYears(params.questionnaire, params.ref ?? new Date());
}

function yearRowUnchanged(prev: object, next: object): boolean {
  const prevRow = prev as Record<string, unknown>;
  const nextRow = next as Record<string, unknown>;
  const prevKeys = Object.keys(prevRow);
  const nextKeys = Object.keys(nextRow);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of prevKeys) {
    if (prevRow[key] !== nextRow[key]) return false;
  }
  return true;
}

/** Keep the previous forms map when year keys and field values (including pldd) are unchanged. */
export function reuseUnchangedYearForms<T extends object>(
  prev: Record<string, T>,
  next: Record<string, T>
): Record<string, T> {
  const nextKeys = Object.keys(next);
  if (Object.keys(prev).length !== nextKeys.length) return next;
  for (const key of nextKeys) {
    const prevRow = prev[key];
    const nextRow = next[key];
    if (!prevRow || !nextRow || !yearRowUnchanged(prevRow, nextRow)) return next;
  }
  return prev;
}

/** Footer hint when required FS input is still missing. */
export function financialStatementsContinueHint(input: {
  readOnly: boolean;
  nextFinancialYearEndComplete: boolean;
  firstIncompleteYear: number | undefined;
}): string | null {
  if (input.readOnly) return null;
  if (!input.nextFinancialYearEndComplete) return "Complete the next financial year end";
  if (input.firstIncompleteYear != null) return `Complete FY${input.firstIncompleteYear}`;
  return null;
}
