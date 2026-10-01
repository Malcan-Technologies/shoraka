"use client";

/**
 * SECTION: Financial tab resubmit comparison (issuer User Input diff)
 * WHY: Shows what the issuer actually changed between two consecutive ApplicationRevision snapshots.
 *      Only FYs with at least one issuer value change are shown; changed rows are highlighted.
 *      Raw issuer unaudited_by_year only. Never Admin Input, Admin overrides, CTOS or gap fills.
 * INPUT: before/after app slices (period line only), financialDiff from diffIssuerFinancialRevisionSnapshots
 * OUTPUT: Financial Summary table (before/after issuer values per changed FY)
 * WHERE USED: FinancialSection comparison mode
 */

import * as React from "react";
import { formatCurrency } from "@cashsouk/config";
import {
  APPLICATION_COMREP_OPTIONAL_KEYS,
  FINANCIAL_FIELD_LABELS,
  type FinancialStatementsQuestionnaire,
  type IssuerFinancialResubmitYearDiff,
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

function questionnaireOf(financialStatements: unknown): FinancialStatementsQuestionnaire | null {
  const fs =
    financialStatements && typeof financialStatements === "object" && !Array.isArray(financialStatements)
      ? (financialStatements as Record<string, unknown>)
      : null;
  const q = fs?.questionnaire;
  return q && typeof q === "object" && !Array.isArray(q) ? (q as FinancialStatementsQuestionnaire) : null;
}

export function ApplicationFinancialReviewComparison({
  beforeApp,
  afterApp,
  financialDiff,
}: {
  beforeApp: { financial_statements?: unknown };
  afterApp: { financial_statements?: unknown };
  financialDiff: IssuerFinancialResubmitYearDiff[];
}) {
  // Modern comparison UI: compare historical revision snapshots (issuer User Input only).
  const beforeQuestionnaire = React.useMemo(
    () => questionnaireOf(beforeApp.financial_statements),
    [beforeApp.financial_statements]
  );
  const afterQuestionnaire = React.useMemo(
    () => questionnaireOf(afterApp.financial_statements),
    [afterApp.financial_statements]
  );

  const yearKeys = React.useMemo(() => financialDiff.map((d) => d.year), [financialDiff]);
  const diffByYear = React.useMemo(
    () => new Map(financialDiff.map((d) => [d.year, d] as const)),
    [financialDiff]
  );

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

  const formatMaybeMoney = React.useCallback((val: number | null | undefined) => {
    if (val == null) return "—";
    return formatCurrency(val, { decimals: 0 });
  }, []);

  const getPeriodLine = React.useCallback(
    (questionnaire: FinancialStatementsQuestionnaire | null, year: number) => {
      const { periodLine } = adminUnauditedYearPresentation(questionnaire, year);
      return periodLine ?? "";
    },
    []
  );

  if (yearKeys.length === 0) {
    return (
      <ReviewFieldBlock title="Financial Summary">
        <p className={reviewEmptyStateClass}>No issuer financial changes in this resubmission.</p>
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
                    getPeriodLine(afterQuestionnaire, year) || getPeriodLine(beforeQuestionnaire, year) || "";
                  return (
                    <TableHead
                      key={`g-${year}`}
                      colSpan={2}
                      className={cn(applicationTableHeaderClass, "border-r border-border text-center last:border-r-0")}
                    >
                      <span className="flex flex-col items-center gap-0.5 text-foreground">
                        <span className="text-ui font-normal leading-snug text-foreground">{`FY${year}`}</span>
                        <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-border bg-muted/50 px-2.5 py-0.5 text-meta font-normal leading-tight text-foreground">
                          User Input
                        </span>
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
                    className={cn(
                      applicationTableCellClass,
                      "bg-muted/35 py-3 border-t border-b border-border/70 text-sm font-semibold text-foreground"
                    )}
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
                        const field = diffByYear.get(year)?.fields[key];
                        const b = formatMaybeMoney(field?.issuerBefore);
                        const a = formatMaybeMoney(field?.issuerAfter);
                        const markedChanged = field?.changed === true;
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
