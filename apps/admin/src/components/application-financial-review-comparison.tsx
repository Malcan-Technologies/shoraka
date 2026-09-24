"use client";

/**
 * SECTION: Financial tab resubmit comparison (unaudited figures only)
 * WHY: Resubmit diff for issuer unaudited_by_year only (up to two years). Directors not compared here.
 * INPUT: before/after app slices, path matcher
 * OUTPUT: Financial Summary table (before/after unaudited)
 * WHERE USED: FinancialSection comparison mode
 */

import * as React from "react";
import { formatCurrency } from "@cashsouk/config";
import {
  APPLICATION_COMREP_OPTIONAL_KEYS,
  FINANCIAL_FIELD_LABELS,
  getIssuerFinancialTabYears,
  issuerUnauditedPlddForFyEndYear,
  parseAdminFieldOverrides,
  type FinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import { ReviewFieldBlock } from "@/components/application-review/review-field-block";
import {
  comparisonSurfaceChangedAfterClass,
  comparisonSurfaceChangedBeforeClass,
  reviewEmptyStateClass,
} from "@/components/application-review/review-section-styles";
import {
  adminFyPeriodLines,
  adminUnauditedYearPresentation,
} from "@/lib/stored-unaudited-years";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  applicationTableHeaderBgClass,
  applicationTableHeaderClass,
  applicationTableRowClass,
  applicationTableCellClass,
  applicationTableWrapperClass,
} from "@/components/application-review/application-table-styles";

/**
 * TEMP: set true to preview unaudited before/after without real resubmit snapshots.
 * Set false before shipping.
 */
const USE_MOCK_FINANCIAL_RESUBMIT_COMPARISON = false;

/**
 * Mock only: 1 = single unaudited year (narrow table, one Unaudited group). 2 = two years (two groups).
 * Real data: slot count follows max(before years, after years), capped at 2.
 */
const MOCK_UNAUDITED_YEAR_COUNT: 1 | 2 = 1;

const MOCK_Q_TWO_TABS: FinancialStatementsQuestionnaire = { financial_year_end: "2027-03-31" };
const MOCK_REF_TWO_TABS = new Date("2026-01-10");
const [MOCK_Y1, MOCK_Y2] = getIssuerFinancialTabYears(MOCK_Q_TWO_TABS, MOCK_REF_TWO_TABS);

const MOCK_Q_ONE_TAB: FinancialStatementsQuestionnaire = { financial_year_end: "2029-03-31" };
const MOCK_REF_ONE_TAB = new Date("2028-11-15");
const MOCK_Y_SUBMITTED = getIssuerFinancialTabYears(MOCK_Q_ONE_TAB, MOCK_REF_ONE_TAB)[0];

function mockUnauditedYearBlock(
  fyEndYear: number,
  q: FinancialStatementsQuestionnaire,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    pldd: issuerUnauditedPlddForFyEndYear(fyEndYear, q),
    bsfatot: 180_000,
    othass: 45_000,
    bscatot: 220_000,
    bsclbank: 30_000,
    curlib: 95_000,
    bsslltd: 110_000,
    bsclstd: 25_000,
    bsqpuc: 160_000,
    turnover: 1_000_000,
    plnpbt: 85_000,
    plnpat: 52_000,
    plnetdiv: 5_000,
    plyear: 12_000,
    ...overrides,
  };
}

type MockFinancialResubmitPayload = {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changedPaths: Set<string>;
};

function buildMockFinancialResubmitPayload(yearCount: 1 | 2): MockFinancialResubmitPayload {
  if (yearCount === 1) {
    return {
      before: {
        questionnaire: MOCK_Q_ONE_TAB,
        unaudited_by_year: {
          [String(MOCK_Y_SUBMITTED)]: mockUnauditedYearBlock(MOCK_Y_SUBMITTED, MOCK_Q_ONE_TAB, {
            turnover: 1_050_000,
            plnpat: 48_000,
          }),
        },
      },
      after: {
        questionnaire: MOCK_Q_ONE_TAB,
        unaudited_by_year: {
          [String(MOCK_Y_SUBMITTED)]: mockUnauditedYearBlock(MOCK_Y_SUBMITTED, MOCK_Q_ONE_TAB, {
            turnover: 1_180_000,
            plnpat: 48_000,
          }),
        },
      },
      changedPaths: new Set([`financial_statements.unaudited_by_year.${MOCK_Y_SUBMITTED}.turnover`]),
    };
  }
  return {
    before: {
      questionnaire: MOCK_Q_TWO_TABS,
      unaudited_by_year: {
        [String(MOCK_Y1)]: mockUnauditedYearBlock(MOCK_Y1, MOCK_Q_TWO_TABS, { turnover: 880_000, plnpat: 41_000 }),
        [String(MOCK_Y2)]: mockUnauditedYearBlock(MOCK_Y2, MOCK_Q_TWO_TABS, { turnover: 1_050_000, plnpat: 48_000 }),
      },
    },
    after: {
      questionnaire: MOCK_Q_TWO_TABS,
      unaudited_by_year: {
        [String(MOCK_Y1)]: mockUnauditedYearBlock(MOCK_Y1, MOCK_Q_TWO_TABS, { turnover: 965_000, plnpat: 41_000 }),
        [String(MOCK_Y2)]: mockUnauditedYearBlock(MOCK_Y2, MOCK_Q_TWO_TABS, { turnover: 1_050_000, plnpat: 61_000 }),
      },
    },
    changedPaths: new Set([
      `financial_statements.unaudited_by_year.${MOCK_Y1}.turnover`,
      `financial_statements.unaudited_by_year.${MOCK_Y2}.plnpat`,
    ]),
  };
}

// (Legacy-only helpers removed; modern comparison UI does not use these.)

function toNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export function ApplicationFinancialReviewComparison({
  beforeApp,
  afterApp,
  isPathChanged,
}: {
  beforeApp: {
    financial_statements?: unknown;
    issuer_organization?: {
      corporate_entities?: unknown;
    } | null;
  };
  afterApp: typeof beforeApp;
  isPathChanged: (path: string) => boolean;
}) {
  // Modern comparison UI: compare historical revision snapshots (incl. admin supplements) instead of
  // the legacy unaudited-only snapshot slice.
  const __mockFinancialPayload = React.useMemo(
    () =>
      USE_MOCK_FINANCIAL_RESUBMIT_COMPARISON
        ? buildMockFinancialResubmitPayload(MOCK_UNAUDITED_YEAR_COUNT)
        : null,
    []
  );

  const __effectiveBeforeApp = React.useMemo(() => {
    if (!__mockFinancialPayload) return beforeApp;
    return { ...beforeApp, financial_statements: __mockFinancialPayload.before };
  }, [beforeApp, __mockFinancialPayload]);

  const __effectiveAfterApp = React.useMemo(() => {
    if (!__mockFinancialPayload) return afterApp;
    return { ...afterApp, financial_statements: __mockFinancialPayload.after };
  }, [afterApp, __mockFinancialPayload]);

  const __effectiveIsPathChanged = React.useCallback(
    (path: string) => {
      if (__mockFinancialPayload && path.startsWith("financial_statements")) {
        return __mockFinancialPayload.changedPaths.has(path);
      }
      return isPathChanged(path);
    },
    [isPathChanged, __mockFinancialPayload]
  );

  type FinancialSide = {
    questionnaire: FinancialStatementsQuestionnaire | null;
    unauditedByYear: Record<string, Record<string, unknown>>;
    adminInputByYear: Record<string, Record<string, unknown>>;
    overridesByYear: Record<string, Record<string, { value: number | string | null }>>;
  };

  const toSide = React.useCallback((financialStatements: unknown): FinancialSide => {
    const fs =
      financialStatements && typeof financialStatements === "object" && !Array.isArray(financialStatements)
        ? (financialStatements as Record<string, unknown>)
        : {};

    const questionnaireRaw = fs.questionnaire;
    const questionnaire =
      questionnaireRaw && typeof questionnaireRaw === "object" && !Array.isArray(questionnaireRaw)
        ? (questionnaireRaw as FinancialStatementsQuestionnaire)
        : null;

    const unauditedRaw = fs.unaudited_by_year;
    const unauditedByYear =
      unauditedRaw && typeof unauditedRaw === "object" && !Array.isArray(unauditedRaw)
        ? (unauditedRaw as Record<string, Record<string, unknown>>)
        : {};

    const adminInputRaw = fs.admin_input_by_year;
    const adminInputByYear =
      adminInputRaw && typeof adminInputRaw === "object" && !Array.isArray(adminInputRaw)
        ? (adminInputRaw as Record<string, Record<string, unknown>>)
        : {};

    const overridesByYearRaw = parseAdminFieldOverrides(fs);
    const overridesByYear: FinancialSide["overridesByYear"] = {};
    for (const [year, fields] of Object.entries(overridesByYearRaw)) {
      overridesByYear[year] = {};
      for (const [fieldKey, override] of Object.entries(fields)) {
        overridesByYear[year]![fieldKey] = { value: override.value };
      }
    }

    return { questionnaire, unauditedByYear, adminInputByYear, overridesByYear };
  }, []);

  const beforeSide = React.useMemo(
    () => toSide(__effectiveBeforeApp.financial_statements),
    [__effectiveBeforeApp, toSide]
  );
  const afterSide = React.useMemo(
    () => toSide(__effectiveAfterApp.financial_statements),
    [__effectiveAfterApp, toSide]
  );

  const yearKeys = React.useMemo(() => {
    const collect = (byYear: Record<string, unknown>) => Object.keys(byYear);
    const fromBefore = [
      ...collect(beforeSide.unauditedByYear),
      ...collect(beforeSide.adminInputByYear),
      ...collect(beforeSide.overridesByYear),
    ];
    const fromAfter = [
      ...collect(afterSide.unauditedByYear),
      ...collect(afterSide.adminInputByYear),
      ...collect(afterSide.overridesByYear),
    ];

    const years = [...new Set([...fromBefore, ...fromAfter])]
      .map((k) => Number(k))
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);

    // Keep the table readable while still supporting Admin-added FY.
    return years.slice(Math.max(0, years.length - 3));
  }, [afterSide, beforeSide]);

  type EquityIfApplicableKey = (typeof APPLICATION_COMREP_OPTIONAL_KEYS)[number];

  const EQUITY_IF_APPLICABLE_KEYS = React.useMemo(
    () => new Set<EquityIfApplicableKey>(APPLICATION_COMREP_OPTIONAL_KEYS as readonly EquityIfApplicableKey[]),
    []
  );

  const isEquityIfApplicableKey = (key: string): key is EquityIfApplicableKey =>
    EQUITY_IF_APPLICABLE_KEYS.has(key as EquityIfApplicableKey);

  const LABELS: Record<string, string> = {
    bsfatot: "Fixed Assets",
    othass: "Other Assets",
    bscatot: "Current Assets",
    bsclbank: "Non-current Assets",
    cashAndBank: "Cash & Bank",
    tradeReceivables: "Trade Receivables",

    curlib: "Current Liabilities",
    bsslltd: "Long-term Liabilities",
    bsclstd: "Non-current Liabilities",
    curlib_borrowing: "Current Borrowings",
    curlib_non_borrowing: "Other Current Liabilities",
    ncl_loan: "Non-current Loans",
    ncl_non_loan: "Other Non-current Liabilities",
    tradePayables: "Trade Payables",

    bsqpuc: "Paid-up Share Capital",
    equity_share_application: "Share Application Account",
    equity_share_premium: "Share Premium & Other Reserves",
    equity_accumulated_profit: "Accumulated Profit / Loss",
    equity_minority: "Equity Minority Interest",

    turnover: "Revenue / Turnover",
    grossProfit: "Gross Profit",
    ebitda: "EBITDA",
    plnpbt: "Profit / Loss Before Tax",
    plnpat: "Profit / Loss After Tax",
    netOperatingIncome: "Net Operating Income",
    plnetdiv: "Net Dividend",
    pl_minority: "P&L Minority Interest",
    plyear: "Profit / Loss of Year",

    costOfSales: "Cost of Sales",
    operating_cost: "Operating Costs",
    admin_cost: "Administrative Costs",
    interest_cost: "Interest Costs",
    other_cost: "Other Costs",

    operatingCashFlow: "Operating Cash Flow",
    freeCashFlow: "Free Cash Flow",
    annualDebtService: "Annual Debt Service",
  };

  const categories: Array<{ title: string; keys: readonly string[] }> = React.useMemo(
    () => [
      { title: "Assets", keys: ["bsfatot", "othass", "bscatot", "bsclbank", "cashAndBank", "tradeReceivables"] },
      {
        title: "Liabilities",
        keys: [
          "curlib",
          "bsslltd",
          "bsclstd",
          "curlib_borrowing",
          "curlib_non_borrowing",
          "ncl_loan",
          "ncl_non_loan",
          "tradePayables",
        ],
      },
      {
        title: "Equity",
        keys: ["bsqpuc", "equity_share_application", "equity_share_premium", "equity_accumulated_profit", "equity_minority"],
      },
      {
        title: "Profit & Loss",
        keys: ["turnover", "grossProfit", "ebitda", "plnpbt", "plnpat", "netOperatingIncome", "plnetdiv", "pl_minority", "plyear"],
      },
      {
        title: "Costs",
        keys: ["costOfSales", "operating_cost", "admin_cost", "interest_cost", "other_cost"],
      },
      {
        title: "Cash Flow / Debt",
        keys: ["operatingCashFlow", "freeCashFlow", "annualDebtService"],
      },
    ],
    []
  );

  const TABLE_MIN_WIDTH =
    yearKeys.length <= 1
      ? "min-w-[700px]"
      : yearKeys.length === 2
        ? "min-w-[980px]"
        : "min-w-[1280px]";
  const colSpan = 1 + yearKeys.length * 2;

  const formatMaybeMoney = React.useCallback((val: unknown) => {
    if (val == null) return "—";
    if (typeof val === "string" && val.trim() === "") return "—";
    return formatCurrency(toNum(val), { decimals: 0 });
  }, []);

  const getPeriodLine = React.useCallback(
    (side: FinancialSide, year: number) => {
      const { periodLine } = adminUnauditedYearPresentation(side.questionnaire, year);
      return periodLine ?? "";
    },
    []
  );

  const getEffectiveRawValue = React.useCallback((side: FinancialSide, year: number, key: string) => {
    const y = String(year);
    const override = side.overridesByYear?.[y]?.[key];
    if (override?.value != null) return override.value;
    const adminVal = side.adminInputByYear?.[y]?.[key];
    if (adminVal != null) return adminVal;
    return side.unauditedByYear?.[y]?.[key] ?? null;
  }, []);

  const rowIsMarkedChanged = React.useCallback(
    (year: number, key: string) => {
      if (__effectiveIsPathChanged("financial_statements")) return true;
      if (__effectiveIsPathChanged(`financial_statements.${key}`)) return true;
      if (__effectiveIsPathChanged(`financial_statements.unaudited_by_year.${year}.${key}`)) return true;
      if (__effectiveIsPathChanged(`financial_statements.admin_input_by_year.${year}.${key}`)) return true;
      if (__effectiveIsPathChanged(`financial_statements.admin_field_overrides.${year}.${key}`)) return true;
      return false;
    },
    [__effectiveIsPathChanged]
  );

  const normCell = (text: string) => (text === "—" ? "" : text.trim());

  if (yearKeys.length === 0) {
    return (
      <ReviewFieldBlock title="Financial Summary">
        <p className={reviewEmptyStateClass}>No financial data in these snapshots.</p>
      </ReviewFieldBlock>
    );
  }

  return (
    <ReviewFieldBlock title="Financial Summary">
      <div className={applicationTableWrapperClass}>
        <div className="overflow-x-auto">
          <Table className={cn("table-fixed w-full text-[15px]", TABLE_MIN_WIDTH)}>
            <TableHeader className={cn(applicationTableHeaderBgClass, "[&_tr]:border-b-border")}>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead
                  rowSpan={2}
                  scope="col"
                  className={cn(
                    applicationTableHeaderClass,
                    "w-[24%] min-w-[160px] border-r border-border bg-muted/30 align-middle font-normal"
                  )}
                >
                  <span className="sr-only">Financial metric</span>
                </TableHead>
                {yearKeys.map((year) => {
                  const periodLine =
                    getPeriodLine(beforeSide, year) || getPeriodLine(afterSide, year) || "";
                  return (
                    <TableHead
                      key={`g-${year}`}
                      colSpan={2}
                      className={cn(applicationTableHeaderClass, "border-r border-border text-center last:border-r-0")}
                    >
                      <span className="flex flex-col items-center gap-0.5 font-semibold text-foreground">
                        <span>{`FY${year}`}</span>
                        {periodLine ? (
                          <span className="text-meta font-normal leading-snug text-muted-foreground">
                            {adminFyPeriodLines(periodLine).map((line) => (
                              <span key={line} className="block whitespace-nowrap">
                                {line}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>

              <TableRow className="hover:bg-transparent border-b border-border">
                {yearKeys.flatMap((year) => [
                  <TableHead
                    key={`${year}-bef`}
                    className={cn(
                      applicationTableHeaderClass,
                      "w-[19%] border-r border-border text-right tabular-nums text-muted-foreground"
                    )}
                  >
                    Before
                  </TableHead>,
                  <TableHead
                    key={`${year}-aft`}
                    className={cn(
                      applicationTableHeaderClass,
                      "w-[19%] border-r border-border text-right tabular-nums text-foreground last:border-r-0"
                    )}
                  >
                    After
                  </TableHead>,
                ])}
              </TableRow>
            </TableHeader>

            <TableBody>
              {categories.flatMap((category) => [
                <TableRow key={`cat-${category.title}`} className={applicationTableRowClass}>
                  <TableCell
                    colSpan={colSpan}
                    className={cn(applicationTableCellClass, "bg-muted/30 font-semibold text-foreground py-3")}
                  >
                    {category.title}
                  </TableCell>
                </TableRow>,
                ...category.keys.map((key) => {
                  const labelBase = LABELS[key] ?? (FINANCIAL_FIELD_LABELS[key] ?? key);
                  const label = isEquityIfApplicableKey(key) ? `${labelBase} (if applicable)` : labelBase;
                  return (
                    <TableRow key={key} className={applicationTableRowClass}>
                      <TableCell
                        className={cn(
                          applicationTableCellClass,
                          "border-r border-border bg-muted/10 font-medium text-foreground pl-6"
                        )}
                      >
                        {label}
                      </TableCell>
                      {yearKeys.flatMap((year) => {
                        const beforeVal = getEffectiveRawValue(beforeSide, year, key);
                        const afterVal = getEffectiveRawValue(afterSide, year, key);
                        const b = formatMaybeMoney(beforeVal);
                        const a = formatMaybeMoney(afterVal);
                        const differs = normCell(b) !== normCell(a);
                        const markedChanged = differs && rowIsMarkedChanged(year, key);
                        return [
                          <TableCell
                            key={`${key}-${year}-b`}
                            className={cn(
                              applicationTableCellClass,
                              "border-r border-border text-right tabular-nums text-muted-foreground",
                              markedChanged && cn(comparisonSurfaceChangedBeforeClass, "rounded-none")
                            )}
                          >
                            <span
                              className={cn(
                                markedChanged &&
                                  b !== "—" &&
                                  "line-through decoration-muted-foreground/80 decoration-1 [text-decoration-skip-ink:none]"
                              )}
                            >
                              {b}
                            </span>
                          </TableCell>,
                          <TableCell
                            key={`${key}-${year}-a`}
                            className={cn(
                              applicationTableCellClass,
                              "border-r border-border text-right tabular-nums text-foreground last:border-r-0",
                              markedChanged && cn(comparisonSurfaceChangedAfterClass, "rounded-none")
                            )}
                          >
                            {a}
                          </TableCell>,
                        ];
                      })}
                    </TableRow>
                  );
                }),
              ])}
            </TableBody>
          </Table>
        </div>
      </div>
    </ReviewFieldBlock>
  );

  // const mockFinancialPayload (legacy render removed; kept for test source slicing)
}
