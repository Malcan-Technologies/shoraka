import { buildStoredApplicationFinancialYearBlock, getIssuerFinancialTabYears } from "@cashsouk/types";
import {
  financialStatementsV2Schema,
  financialStatementsV2StoredSchema,
  type FinancialStatementsV2Stored,
} from "./schemas";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function peekFinancialYearEndIso(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const q = (raw as Record<string, unknown>).questionnaire;
  if (!q || typeof q !== "object" || Array.isArray(q)) return null;
  const fye = (q as Record<string, unknown>).financial_year_end;
  return typeof fye === "string" && ISO_DATE.test(fye.trim()) ? fye.trim() : null;
}

export function storedUnauditedYearNumbers(stored: unknown): number[] {
  const parsed = financialStatementsV2StoredSchema.safeParse(stored);
  if (!parsed.success) return [];
  return Object.keys(parsed.data.unaudited_by_year)
    .map((key) => Number(key))
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => a - b);
}

/** Amendment may keep a legacy beyond-window FYE only when the issuer does not change it. */
export function shouldPreserveStoredFinancialYears(params: {
  applicationStatus: string;
  storedFinancialStatements: unknown;
  incomingFinancialYearEnd: string | null;
}): boolean {
  if (params.applicationStatus !== "AMENDMENT_REQUESTED") return false;
  const storedFye = peekFinancialYearEndIso(params.storedFinancialStatements);
  return (
    storedFye != null &&
    params.incomingFinancialYearEnd != null &&
    storedFye === params.incomingFinancialYearEnd
  );
}

export function parseFinancialStatementsForStepSave(params: {
  applicationStatus: string;
  storedFinancialStatements: unknown;
  payload: unknown;
  now?: Date;
}):
  | { ok: true; data: FinancialStatementsV2Stored; expectedYears: number[] }
  | { ok: false; message: string } {
  const now = params.now ?? new Date();
  const incomingFye = peekFinancialYearEndIso(params.payload);
  const preserve = shouldPreserveStoredFinancialYears({
    applicationStatus: params.applicationStatus,
    storedFinancialStatements: params.storedFinancialStatements,
    incomingFinancialYearEnd: incomingFye,
  });
  const parsed = preserve
    ? financialStatementsV2StoredSchema.safeParse(params.payload)
    : financialStatementsV2Schema.safeParse(params.payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors.map((e) => e.message).join("; ") };
  }

  const storedYears = storedUnauditedYearNumbers(params.storedFinancialStatements);
  const expectedYears = preserve && storedYears.length > 0
    ? storedYears
    : getIssuerFinancialTabYears(parsed.data.questionnaire, now);

  // Return stored-normalized blocks (canonical keys present; missing numerics become 0 via
  // buildStoredApplicationFinancialYearBlock) so callers/tests can reliably render diffs.
  const normalizedUnauditedByYear: Record<string, unknown> = {};
  for (const [year, block] of Object.entries(parsed.data.unaudited_by_year)) {
    normalizedUnauditedByYear[year] = buildStoredApplicationFinancialYearBlock(
      block as Record<string, unknown>
    );
  }

  return {
    ok: true,
    data: {
      ...parsed.data,
      unaudited_by_year: normalizedUnauditedByYear as FinancialStatementsV2Stored["unaudited_by_year"],
    },
    expectedYears,
  };
}
