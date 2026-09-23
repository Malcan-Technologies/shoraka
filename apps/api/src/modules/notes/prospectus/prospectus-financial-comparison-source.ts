/**
 * SECTION: Build Page 2 financial comparison source / year selection (Stage 4A)
 * WHY: Align with Admin Financial Statements year set; max 3; oldest→newest
 */

import {
  buildNormalizedFinancialStatementYearSet,
  getEligibleAdminInputYears,
  findMissingSsmExpectedUnauditedYears,
  formatFinancialYearEndDisplayLabel,
  formatMissingSsmUnauditedYearsOpsWarning,
  computeColumnMetrics,
  financialFormToBsPl,
  computeEbit,
  computeQuickRatio,
  computeInterestCoverage,
  computeReceivablesDays,
  computePayablesDays,
  computeNetDebtEquity,
  computeDscr,
  resolveFinancialStatementSourceFooter,
  selectLatestNormalizedFinancialStatementYears,
} from "@cashsouk/types";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS,
  PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
  PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  PROSPECTUS_FINANCIAL_COMPARISON_TABLE_UNIT_LABEL,
  type ProspectusFinancialComparisonSource,
  type ProspectusFinancialComparisonSourceInput,
  type ProspectusFinancialComparisonYear,
} from "./prospectus-financial-comparison-source.types";

export function formatProspectusFinancialYearLabel(year: number): string {
  return `FY${year}`;
}

export function formatProspectusFinancialYearEndLabel(
  financialYearEndIso: string | null | undefined
): string {
  if (!financialYearEndIso) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const label = formatFinancialYearEndDisplayLabel(financialYearEndIso);
  return label || PROSPECTUS_DATA_NOT_AVAILABLE;
}

/**
 * @deprecated Prefer shared `selectLatestNormalizedFinancialStatementYears`.
 * Kept for tests that assert ascending display of year numbers.
 */
export function selectProspectusFinancialComparisonYears(yearKeys: Iterable<string>): number[] {
  const valid = new Set<number>();
  for (const key of yearKeys) {
    if (!/^\d{4}$/.test(key)) continue;
    const year = Number(key);
    if (Number.isInteger(year) && year >= 1000 && year <= 9999) valid.add(year);
  }
  const descending = [...valid].sort((a, b) => b - a);
  return descending
    .slice(0, PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS)
    .sort((a, b) => a - b);
}

export function isProspectusFinancialYearKey(key: string): boolean {
  if (!/^\d{4}$/.test(key)) return false;
  const year = Number(key);
  return Number.isInteger(year) && year >= 1000 && year <= 9999;
}

export function buildProspectusFinancialComparisonSource(
  input: ProspectusFinancialComparisonSourceInput
): ProspectusFinancialComparisonSource {
  const available = buildNormalizedFinancialStatementYearSet({
    financialStatements: input.financialStatements,
    ctosFinancials: input.ctosFinancials,
    ref: input.ref,
  });
  const selected = selectLatestNormalizedFinancialStatementYears(
    available,
    PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS
  );

  const overlayKeys = [
    "grossProfit",
    "ebitda",
    "cashAndBank",
    "tradeReceivables",
    "tradePayables",
    "costOfSales",
    "annualDebtService",
    "netOperatingIncome",
    "interest_cost",
    "curlib_borrowing",
    "ncl_loan",
    "operatingCashFlow",
    "freeCashFlow",
  ] as const;

  // For CTOS/audited year selection, Stage 4A normally prefers CTOS raw fields.
  // For Prospectus-only missing raw facts, overlay issuer-submitted unaudited values (when present)
  // so Prospectus can always read canonical issuer raw inputs.
  const unauditedByYearMaybe =
    input.financialStatements &&
    typeof input.financialStatements === "object" &&
    "unaudited_by_year" in input.financialStatements
      ? (input.financialStatements as any)["unaudited_by_year"]
      : undefined;

  const unauditedByYear: Record<string, unknown> =
    unauditedByYearMaybe &&
    typeof unauditedByYearMaybe === "object" &&
    !Array.isArray(unauditedByYearMaybe)
      ? unauditedByYearMaybe
      : ({} as Record<string, unknown>);

  const years: ProspectusFinancialComparisonYear[] = [];
  for (let i = 0; i < selected.length; i += 1) {
    const year = selected[i]!;
    // Stage 4A rawFinancials feed both Page 2 and Page 3.
    // CTOS audited years already have totals/ratios; unaudited management years only have core lines.
    const rawFinancials: Record<string, unknown> = { ...year.rawFinancials };

    // Overlay issuer submitted raw fields only when this FY is actually
    // an unaudited issuer FY in the resolved recordSource set.
    //
    // NEVER overlay into CTOS-backed FYs (one FY = one active source),
    // and NEVER overlay into Admin-input FYs.
    if (year.recordSource === "unaudited_management") {
      const fyKey = String(year.year);
      const storedBlock = unauditedByYear[fyKey];
      if (storedBlock && typeof storedBlock === "object" && !Array.isArray(storedBlock)) {
        for (const k of overlayKeys) {
          const v = (storedBlock as Record<string, unknown>)[k];
          if (v != null && v !== "") rawFinancials[k] = v;
        }
      }
    }

    if (year.recordSource === "unaudited_management" || year.recordSource === "admin_input") {
      const fsInput = rawFinancials as any;
      const { bs, pl } = financialFormToBsPl(fsInput);
      const metrics = computeColumnMetrics(bs, pl, null);

      // Provide Prospectus-ready derived fields for unaudited management years.
      // These are consumed by CTOS-style resolvers during Page 2/3 rendering.
      rawFinancials.totass = metrics.totass;
      rawFinancials.totlib = metrics.totlib;
      rawFinancials.networth = metrics.networth;
      rawFinancials.currat = metrics.currat;
      // Prospectus expects return_on_equity in percent-points form.
      rawFinancials.return_on_equity =
        metrics.return_of_equity == null ? null : metrics.return_of_equity * 100;

      // Debt / Equity prefers `gear` when present, but can fall back to totlib/networth.
      rawFinancials.gear =
        metrics.networth === 0 ? null : metrics.totlib / metrics.networth;
    }

    // Derived issuer metrics for both CTOS-audited and unaudited management years.
    // These feed Admin / Prospectus read-only display.
    const fs = rawFinancials as any;
    const ebit = computeEbit(fs.plnpbt, fs.interest_cost);
    rawFinancials.ebit = ebit;
    rawFinancials.quickRatio = computeQuickRatio(fs.cashAndBank, fs.tradeReceivables, fs.curlib);
    rawFinancials.interestCoverage = computeInterestCoverage(ebit, fs.interest_cost);
    // Receivables Days follows SoukScore: Average AR from consecutive FYs.
    // If we cannot establish Beginning AR from the immediately prior consecutive FY, return null.
    const priorYearRaw =
      years[i - 1]?.year === year.year - 1 ? (years[i - 1]?.rawFinancials as any) : null;
    const beginningAr = priorYearRaw?.tradeReceivables ?? null;
    rawFinancials.receivablesDays = computeReceivablesDays(
      beginningAr,
      fs.tradeReceivables,
      fs.turnover
    );
    rawFinancials.payablesDays = computePayablesDays(fs.tradePayables, fs.costOfSales);
    rawFinancials.netDebtEquity = computeNetDebtEquity({
      curlib_borrowing: fs.curlib_borrowing,
      ncl_loan: fs.ncl_loan,
      cashAndBank: fs.cashAndBank,
      networth: fs.networth,
    });
    // Current CashSouk DSCR behavior uses EBITDA as the numerator.
    // (Net Operating Income support is handled elsewhere when explicitly available.)
    // DSCR numerator prefers `netOperatingIncome` when present; otherwise fall back to EBITDA
    // for legacy fixtures/flows that only provide `ebitda`.
    const dscrNumerator =
      typeof fs.netOperatingIncome === "number" ? fs.netOperatingIncome : fs.ebitda;
    rawFinancials.dscr = computeDscr(dscrNumerator, fs.annualDebtService);

    years.push({
      year: year.year,
      yearLabel: formatProspectusFinancialYearLabel(year.year),
      financialYearEndIso: year.financialYearEndIso,
      financialYearEndLabel: formatProspectusFinancialYearEndLabel(year.financialYearEndIso),
      recordSource: year.recordSource,
      statementType: year.statementType,
      rawFinancials,
    });
  }

  const adminFallbackEligibleYears = getEligibleAdminInputYears({
    financialStatements: input.financialStatements,
    ctosFinancials: input.ctosFinancials,
    ref: input.ref,
  });

  const missingSsmUnauditedYears = findMissingSsmExpectedUnauditedYears({
    financialStatements: input.financialStatements,
    ctosFinancials: input.ctosFinancials,
    ref: input.ref,
  });

  return {
    sectionHeading: PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
    tableUnitLabel: PROSPECTUS_FINANCIAL_COMPARISON_TABLE_UNIT_LABEL,
    sourceFooter: resolveFinancialStatementSourceFooter(years),
    years,
    adminFallbackEligibleYears,
    missingSsmUnauditedYears,
    opsWarning: formatMissingSsmUnauditedYearsOpsWarning(missingSsmUnauditedYears),
    audit: PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  };
}
