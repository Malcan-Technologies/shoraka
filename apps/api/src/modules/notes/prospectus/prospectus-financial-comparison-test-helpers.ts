/**
 * Test / sample support only (production code must not import this file).
 * WHY: Fixtures describe application financial_statements + CTOS rows; the Prospectus now
 * displays a Financial Review result, so fixtures go through the same resolver Financial Review
 * uses, then through the production source adapter.
 */

import {
  resolveFinancialReviewResult,
  type ApprovedFinancialResult,
  type FinancialReviewResult,
} from "@cashsouk/types";
import {
  buildNoteFinancialSnapshot,
  type NoteFinancialSnapshot,
} from "../note-financial-snapshot.types";
import { buildProspectusFinancialComparisonSourceFromResult } from "./prospectus-financial-comparison-source";
import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";

/** Application financial_statements + CTOS financials_json + year-selection reference date. */
export type ProspectusFinancialFixtureInputs = {
  financialStatements?: unknown;
  ctosFinancials?: unknown;
  ref: Date;
};

export function financialReviewResultFromInputs(
  input: ProspectusFinancialFixtureInputs
): FinancialReviewResult {
  return resolveFinancialReviewResult({
    financialStatements: input.financialStatements,
    ctosFinancials: input.ctosFinancials,
    referenceDate: input.ref,
  });
}

/** Stage 4A source as the Prospectus shows it once Financial Review has approved these inputs. */
export function buildProspectusFinancialComparisonSourceFromInputs(
  input: ProspectusFinancialFixtureInputs
): ProspectusFinancialComparisonSource {
  return buildProspectusFinancialComparisonSourceFromResult(financialReviewResultFromInputs(input));
}

/** Wrap a Financial Review result the way Financial APPROVED stores it. */
export function approvedFinancialResultOf(
  result: FinancialReviewResult,
  overrides: Partial<Omit<ApprovedFinancialResult, keyof FinancialReviewResult>> = {}
): ApprovedFinancialResult {
  return {
    ...result,
    version: 1,
    application_id: "app-fixture",
    review_cycle: 1,
    approved_at: "2026-01-01T00:00:00.000Z",
    reviewer_user_id: null,
    ctos_report: null,
    ...overrides,
  };
}

export function approvedFinancialResultFromInputs(
  input: ProspectusFinancialFixtureInputs
): ApprovedFinancialResult {
  return approvedFinancialResultOf(financialReviewResultFromInputs(input));
}

/** Note.financial_snapshot as Note creation stores it (JSON round trip included). */
export function noteFinancialSnapshotOf(
  result: ApprovedFinancialResult,
  capturedAt: Date = new Date("2026-01-02T00:00:00.000Z")
): NoteFinancialSnapshot {
  return JSON.parse(JSON.stringify(buildNoteFinancialSnapshot(result, capturedAt))) as NoteFinancialSnapshot;
}

const ACCOUNT_KEYS = [
  "bsfatot",
  "othass",
  "bscatot",
  "bsclbank",
  "cashAndBank",
  "totass",
  "curlib",
  "curlib_borrowing",
  "bsslltd",
  "bsclstd",
  "tradePayables",
  "totlib",
  "bsqpuc",
  "tradeReceivables",
  "turnover",
  "plnpbt",
  "plnpat",
  "plnetdiv",
  "plyear",
  "networth",
  "turnover_growth",
  "profit_margin",
  "return_on_equity",
  "currat",
  "workcap",
  "gear",
  "grossProfit",
  "ebitda",
  "netOperatingIncome",
  "operatingCashFlow",
  "freeCashFlow",
  "interest_cost",
  "ncl_loan",
  "costOfSales",
  "annualDebtService",
] as const;

function toAccount(raw: Record<string, unknown>): Record<string, number | null> {
  const account: Record<string, number | null> = {};
  for (const key of ACCOUNT_KEYS) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) account[key] = v;
    else if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v.replace(/,/g, ""));
      account[key] = Number.isFinite(n) ? n : null;
    } else account[key] = null;
  }
  return account;
}

/** Build Prospectus financial comparison source from calendar-year field maps. */
export function financialSourceFromYearBlocks(
  years: Record<string, Record<string, unknown>>,
  options?: { financialYearEnd?: string; ref?: Date; issuerOverlay?: boolean }
): ProspectusFinancialComparisonSource {
  const ctosFinancials = Object.entries(years)
    .filter(([key]) => /^\d{4}$/.test(key))
    .map(([yearKey, raw]) => {
      const year = Number(yearKey);
      const pldd =
        typeof raw.pldd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.pldd)
          ? raw.pldd
          : `${year}-12-31`;
      return {
        financial_year: year,
        dates: { pldd, bsdd: null as null },
        account: toAccount(raw),
      };
    });

  const unaudited_by_year = options?.issuerOverlay
    ? Object.fromEntries(
        Object.entries(years).filter(([key]) => /^\d{4}$/.test(key))
      )
    : {};

  return buildProspectusFinancialComparisonSourceFromInputs({
    financialStatements: {
      questionnaire: {
        financial_year_end: options?.financialYearEnd ?? "2027-12-31",
      },
      unaudited_by_year,
    },
    ctosFinancials,
    ref: options?.ref ?? new Date("2026-07-17T00:00:00.000Z"),
  });
}
