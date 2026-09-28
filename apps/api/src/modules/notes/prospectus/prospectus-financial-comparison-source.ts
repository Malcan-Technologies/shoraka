/**
 * SECTION: Build Page 2 financial comparison source / year selection (Stage 4A)
 * WHY: Align with Admin Financial Statements year set; max 3; oldest→newest
 */

import {
  applyResolvedRawFields,
  buildNormalizedFinancialStatementYearSet,
  ctosFinancialRowToFsFields,
  getEligibleAdminInputYears,
  getFinancialYearPeriodEndIso,
  getLatestThreeCtosYears,
  financialYearBlockHasActualData,
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
  parseAdminFieldOverrides,
  parseCtosFinancialStatementRows,
  parseFinancialStatementsQuestionnaireShape,
  readFiniteFinancialNumber,
  resolveFinancialStatementSourceFooter,
  selectLatestNormalizedFinancialStatementYears,
  type FinancialStatementStatementType,
  type NormalizedFinancialStatementYear,
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function asYearBlock(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function blockWithActualData(value: unknown): Record<string, unknown> | null {
  const block = asYearBlock(value);
  if (!block || !financialYearBlockHasActualData(block)) return null;
  return block;
}

function statementTypeOfBlock(block: Record<string, unknown>): FinancialStatementStatementType {
  const statementType = block.statementType;
  if (
    statementType === "AUDITED" ||
    statementType === "NOT_AUDITED" ||
    statementType === "MANAGEMENT_ACCOUNTS"
  ) {
    return statementType;
  }
  return "NOT_AUDITED";
}

function financialYearEndIsoFor(
  year: number,
  rawFinancials: Record<string, unknown>,
  questionnaire: ReturnType<typeof parseFinancialStatementsQuestionnaireShape>
): string {
  const pldd = rawFinancials.pldd;
  if (typeof pldd === "string" && ISO_DATE.test(pldd.trim())) return pldd.trim();
  if (questionnaire) {
    const fromQuestionnaire = getFinancialYearPeriodEndIso(questionnaire, year);
    if (fromQuestionnaire && ISO_DATE.test(fromQuestionnaire)) return fromQuestionnaire;
  }
  return `${year}-12-31`;
}

export function buildProspectusFinancialComparisonSource(
  input: ProspectusFinancialComparisonSourceInput
): ProspectusFinancialComparisonSource {
  const available = buildNormalizedFinancialStatementYearSet({
    financialStatements: input.financialStatements,
    ctosFinancials: input.ctosFinancials,
    ref: input.ref,
  });
  const questionnaireRoot =
    input.financialStatements &&
    typeof input.financialStatements === "object" &&
    !Array.isArray(input.financialStatements)
      ? (input.financialStatements as Record<string, unknown>).questionnaire
      : undefined;
  const questionnaire = parseFinancialStatementsQuestionnaireShape(questionnaireRoot);
  const ctosRows = parseCtosFinancialStatementRows(input.ctosFinancials);
  // CTOS ownership is the financial_year key, including rows whose amounts are all null.
  const ctosByYear = new Map<number, (typeof ctosRows)[number]>();
  for (const row of ctosRows) {
    if (row.financial_year == null || !Number.isFinite(row.financial_year)) continue;
    ctosByYear.set(row.financial_year, row);
  }
  const ctosOwnedYears = new Set(ctosByYear.keys());

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

  // Issuer-only raw keys are copied onto a reviewed User Input year. They are not a CTOS fallback.
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

  const adminInputByYearMaybe =
    input.financialStatements &&
    typeof input.financialStatements === "object" &&
    "admin_input_by_year" in input.financialStatements
      ? (input.financialStatements as any)["admin_input_by_year"]
      : undefined;

  const adminInputByYear: Record<string, unknown> =
    adminInputByYearMaybe &&
    typeof adminInputByYearMaybe === "object" &&
    !Array.isArray(adminInputByYearMaybe)
      ? (adminInputByYearMaybe as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const overridesByYear = parseAdminFieldOverrides(input.financialStatements);

  // The shared SSM year set omits Admin Input that sits outside the issuer filing window.
  // Prospectus still needs those active Admin Input years, and a null-amount CTOS row
  // still owns its FY so the stored Admin Input statement stays superseded.
  const presentYears = new Set(available.map((year) => year.year));
  for (const year of getLatestThreeCtosYears(ctosRows)) {
    if (presentYears.has(year)) continue;
    const row = ctosByYear.get(year);
    if (!row) continue;
    const rawFinancials = ctosFinancialRowToFsFields(row);
    available.push({
      year,
      financialYearEndIso: financialYearEndIsoFor(year, rawFinancials, questionnaire),
      recordSource: "ctos_audited",
      statementType: "AUDITED",
      rawFinancials,
    });
    presentYears.add(year);
  }
  for (const [fyKey, storedAdmin] of Object.entries(adminInputByYear)) {
    if (!isProspectusFinancialYearKey(fyKey)) continue;
    const year = Number(fyKey);
    if (presentYears.has(year) || ctosOwnedYears.has(year)) continue;
    const adminBlock = blockWithActualData(storedAdmin);
    if (!adminBlock) continue;
    const userBlock = blockWithActualData(unauditedByYear[fyKey]);
    const rawFinancials = { ...(userBlock ?? adminBlock) };
    const supplemented: NormalizedFinancialStatementYear = userBlock
      ? {
          year,
          financialYearEndIso: financialYearEndIsoFor(year, rawFinancials, questionnaire),
          recordSource: "unaudited_management",
          statementType: "MANAGEMENT_ACCOUNTS",
          rawFinancials,
        }
      : {
          year,
          financialYearEndIso: financialYearEndIsoFor(year, rawFinancials, questionnaire),
          recordSource: "admin_input",
          statementType: statementTypeOfBlock(adminBlock),
          rawFinancials,
        };
    available.push(supplemented);
    presentYears.add(year);
  }

  const selected = selectLatestNormalizedFinancialStatementYears(
    available,
    PROSPECTUS_FINANCIAL_COMPARISON_MAX_YEARS
  );

  const resolveYearRaw = (
    year: (typeof available)[number]
  ): {
    rawFinancials: Record<string, unknown>;
    recordSource: typeof year.recordSource;
    statementType: typeof year.statementType;
  } => {
    const fyKey = String(year.year);
    let effectiveRecordSource = year.recordSource;
    let effectiveStatementType = year.statementType;
    let effectiveRawFinancials: Record<string, unknown> = { ...year.rawFinancials };

    // Prospectus source for one FY: reviewed User Input, else CTOS, else active Admin Input.
    // A CTOS financial_year owns that FY even when every amount is null, so stored Admin Input
    // is not applied. Explicit CTOS gap-fills are applied later, only on a CTOS year.
    const userBlock = blockWithActualData(unauditedByYear[fyKey]);
    const ctosRow = ctosByYear.get(year.year);
    const adminBlock = blockWithActualData(adminInputByYear[fyKey]);
    if (userBlock) {
      effectiveRecordSource = "unaudited_management";
      effectiveRawFinancials = { ...userBlock };
      effectiveStatementType = "MANAGEMENT_ACCOUNTS";
    } else if (ctosRow) {
      effectiveRecordSource = "ctos_audited";
      effectiveRawFinancials = ctosFinancialRowToFsFields(ctosRow);
      effectiveStatementType = "AUDITED";
    } else if (adminBlock) {
      effectiveRecordSource = "admin_input";
      effectiveRawFinancials = { ...adminBlock };
      effectiveStatementType = statementTypeOfBlock(adminBlock);
    }

    // Overlay issuer submitted raw fields only when this FY resolves to an unaudited issuer FY.
    if (effectiveRecordSource === "unaudited_management") {
      const storedBlock = unauditedByYear[fyKey];
      if (storedBlock && typeof storedBlock === "object" && !Array.isArray(storedBlock)) {
        for (const k of overlayKeys) {
          const v = (storedBlock as Record<string, unknown>)[k];
          if (v != null && v !== "") effectiveRawFinancials[k] = v;
        }
      }
    }

    const resolvedRaw = applyResolvedRawFields({
      recordSource: effectiveRecordSource,
      rawFinancials: effectiveRawFinancials,
      overridesForYear: overridesByYear[fyKey],
    });

    // Explicit CTOS gap-fills only. They must not supplement User Input or Admin Input years.
    const overridesForYear = overridesByYear[fyKey];
    if (effectiveRecordSource === "ctos_audited" && overridesForYear) {
      for (const [fieldKey, override] of Object.entries(overridesForYear)) {
        if (override?.action !== "add_missing_ctos_field") continue;
        if (override?.baseSource !== "ctos") continue;
        if (override?.value == null) continue;

        const current = resolvedRaw[fieldKey];
        const isMissing =
          current == null || current === "" || (typeof current === "number" && Number.isNaN(current));
        if (isMissing) {
          resolvedRaw[fieldKey] = override.value as any;
        }
      }
    }

    return {
      rawFinancials: resolvedRaw,
      recordSource: effectiveRecordSource,
      statementType: effectiveStatementType,
    };
  };

  const resolvedRawByYear = new Map<number, Record<string, unknown>>();
  const resolvedMetaByYear = new Map<
    number,
    { recordSource: (typeof available)[number]["recordSource"]; statementType: (typeof available)[number]["statementType"] }
  >();
  for (const year of available) {
    const resolved = resolveYearRaw(year);
    resolvedRawByYear.set(year.year, resolved.rawFinancials);
    resolvedMetaByYear.set(year.year, {
      recordSource: resolved.recordSource,
      statementType: resolved.statementType,
    });
  }

  const years: ProspectusFinancialComparisonYear[] = [];
  for (const year of selected) {
    // Stage 4A rawFinancials feed both Page 2 and Page 3.
    const rawFinancials: Record<string, unknown> = {
      ...(resolvedRawByYear.get(year.year) ?? year.rawFinancials),
    };

    const effectiveRecordSource =
      resolvedMetaByYear.get(year.year)?.recordSource ?? year.recordSource;
    if (effectiveRecordSource === "unaudited_management" || effectiveRecordSource === "admin_input") {
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
        metrics.networth == null || metrics.networth === 0 || metrics.totlib == null
          ? null
          : metrics.totlib / metrics.networth;
    }

    // Derived issuer metrics for both CTOS-audited and unaudited management years.
    // These feed Admin / Prospectus read-only display.
    const fs = rawFinancials as any;
    const ebit = computeEbit(fs.plnpbt, fs.interest_cost);
    rawFinancials.ebit = ebit;
    rawFinancials.quickRatio = computeQuickRatio(fs.cashAndBank, fs.tradeReceivables, fs.curlib);
    rawFinancials.interestCoverage = computeInterestCoverage(ebit, fs.interest_cost);
    // Receivables Days follows SoukScore: Average AR from consecutive FYs.
    // Beginning AR may come from a prior FY that is outside the visible three-year window.
    const priorYearRaw = resolvedRawByYear.get(year.year - 1) ?? null;
    const beginningAr = priorYearRaw
      ? readFiniteFinancialNumber(priorYearRaw.tradeReceivables)
      : null;
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
    // DSCR strictly follows the agreed mapping:
    // Net Operating Income ÷ Annual Debt Service (no EBITDA fallback).
    rawFinancials.dscr = computeDscr(
      typeof fs.netOperatingIncome === "number" ? fs.netOperatingIncome : null,
      fs.annualDebtService
    );

    years.push({
      year: year.year,
      yearLabel: formatProspectusFinancialYearLabel(year.year),
      financialYearEndIso: year.financialYearEndIso,
      financialYearEndLabel: formatProspectusFinancialYearEndLabel(year.financialYearEndIso),
      recordSource:
        resolvedMetaByYear.get(year.year)?.recordSource ?? year.recordSource,
      statementType:
        resolvedMetaByYear.get(year.year)?.statementType ?? year.statementType,
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
