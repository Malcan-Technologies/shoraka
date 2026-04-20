"use client";

/**
 * SECTION: Financial tab resubmit comparison (unaudited figures only)
 * WHY: Resubmit diff for issuer unaudited_by_year only (up to two years). Directors not compared here.
 * INPUT: before/after app slices, path matcher
 * OUTPUT: Financial Summary table (before/after unaudited)
 * WHERE USED: FinancialSection comparison mode
 */

import * as React from "react";
import { formatCurrency, formatNumber } from "@cashsouk/config";
import {
  FINANCIAL_FIELD_LABELS,
  computeColumnMetrics,
  financialFormToBsPl,
  getIssuerFinancialTabYears,
  issuerUnauditedPlddForFyEndYear,
  type FinancialStatementsInput,
  type FinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import { ReviewFieldBlock } from "@/components/application-review/review-field-block";
import {
  comparisonSurfaceChangedAfterClass,
  comparisonSurfaceChangedBeforeClass,
  reviewEmptyStateClass,
} from "@/components/application-review/review-section-styles";
import { extractQuestionnaireAndUnaudited } from "@/components/application-financial-review-content";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format, isValid, parse, parseISO } from "date-fns";
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

function formatFinancialDateDisplay(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === "") return "\u2014";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = parseISO(s);
    if (isValid(d)) return format(d, "d/M/yyyy");
  }
  try {
    const dmy = parse(s, "d/M/yyyy", new Date());
    if (isValid(dmy)) return format(dmy, "d/M/yyyy");
  } catch {
    /* ignore */
  }
  try {
    const d2 = parse(s, "dd/MM/yyyy", new Date());
    if (isValid(d2)) return format(d2, "d/M/yyyy");
  } catch {
    /* ignore */
  }
  return s;
}

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

function financialCellsDiffer(before: string, after: string): boolean {
  const norm = (v: string) => {
    if (v === "—" || v.trim() === "") return "";
    return v.trim();
  };
  return norm(before) !== norm(after);
}

const MAX_UNAUDITED_SLOTS = 2;

function sortedUnauditedYearKeys(byYear: Record<string, Record<string, unknown>>): string[] {
  return Object.keys(byYear)
    .filter((k) => {
      const b = byYear[k];
      return b != null && typeof b === "object" && !Array.isArray(b);
    })
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

type UnauditedSlot = { beforeYear: string | null; afterYear: string | null };

function buildUnauditedSlots(
  beforeKeys: string[],
  afterKeys: string[]
): UnauditedSlot[] {
  const n = Math.min(
    MAX_UNAUDITED_SLOTS,
    Math.max(beforeKeys.length, afterKeys.length, beforeKeys.length || afterKeys.length ? 1 : 0)
  );
  if (n === 0) return [];
  const slots: UnauditedSlot[] = [];
  for (let i = 0; i < n; i++) {
    slots.push({
      beforeYear: beforeKeys[i] ?? null,
      afterYear: afterKeys[i] ?? null,
    });
  }
  return slots;
}

function rowMarkedChangedFinancial(
  rowId: string,
  slot: UnauditedSlot,
  isPathChanged: (path: string) => boolean
): boolean {
  if (isPathChanged("financial_statements")) return true;
  if (isPathChanged(`financial_statements.${rowId}`)) return true;
  if (isPathChanged(`financial_statements.input.${rowId}`)) return true;
  if (
    slot.beforeYear &&
    isPathChanged(`financial_statements.unaudited_by_year.${slot.beforeYear}.${rowId}`)
  ) {
    return true;
  }
  if (
    slot.afterYear &&
    isPathChanged(`financial_statements.unaudited_by_year.${slot.afterYear}.${rowId}`)
  ) {
    return true;
  }
  return false;
}

const COMPUTED_FIELD_LABELS: Record<string, string> = {
  totass: "Total Assets",
  totlib: "Total Liability",
  networth: "Net Worth",
  turnover_growth: "Turnover Growth",
  profit_margin: "Profit Margin",
  return_of_equity: "Return of Equity",
  currat: "Current Ratio",
  workcap: "Working Capital",
};

function toNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function financialRecordToInput(fs: Record<string, unknown>): FinancialStatementsInput {
  return {
    bsfatot: toNum(fs.bsfatot),
    othass: toNum(fs.othass),
    bscatot: toNum(fs.bscatot),
    bsclbank: toNum(fs.bsclbank),
    curlib: toNum(fs.curlib),
    bsslltd: toNum(fs.bsslltd),
    bsclstd: toNum(fs.bsclstd),
    bsqpuc: toNum(fs.bsqpuc),
    turnover: toNum(fs.turnover),
    plnpat: toNum(fs.plnpat),
  };
}

function formatIssuerFinancialCell(rowId: string, fs: Record<string, unknown> | null): string {
  if (!fs || Object.keys(fs).length === 0) return "—";
  const input = financialRecordToInput(fs);
  const { bs, pl } = financialFormToBsPl(input);
  const computed = computeColumnMetrics(bs, pl, null);

  switch (rowId) {
    case "pldd":
      return fs.pldd != null && fs.pldd !== "" ? formatFinancialDateDisplay(String(fs.pldd)) : "—";
    case "bsfatot":
      return formatCurrency(toNum(fs.bsfatot), { decimals: 0 });
    case "othass":
      return formatCurrency(toNum(fs.othass), { decimals: 0 });
    case "bscatot":
      return formatCurrency(toNum(fs.bscatot), { decimals: 0 });
    case "bsclbank":
      return formatCurrency(toNum(fs.bsclbank), { decimals: 0 });
    case "totass":
      return formatCurrency(computed.totass, { decimals: 0 });
    case "curlib":
      return formatCurrency(toNum(fs.curlib), { decimals: 0 });
    case "bsslltd":
      return formatCurrency(toNum(fs.bsslltd), { decimals: 0 });
    case "bsclstd":
      return formatCurrency(toNum(fs.bsclstd), { decimals: 0 });
    case "totlib":
      return formatCurrency(computed.totlib, { decimals: 0 });
    case "networth":
      return formatCurrency(computed.networth, { decimals: 0 });
    case "bsqpuc":
      return formatCurrency(toNum(fs.bsqpuc), { decimals: 0 });
    case "turnover":
      return formatCurrency(toNum(fs.turnover), { decimals: 0 });
    case "plnpbt":
      return formatCurrency(toNum(fs.plnpbt), { decimals: 0 });
    case "plnpat":
      return formatCurrency(toNum(fs.plnpat), { decimals: 0 });
    case "plnetdiv":
      return formatCurrency(toNum(fs.plnetdiv), { decimals: 0 });
    case "plyear":
      return formatCurrency(toNum(fs.plyear), { decimals: 0 });
    case "turnover_growth":
      return computed.turnover_growth == null ? "—" : formatNumber(computed.turnover_growth * 100, 2) + "%";
    case "profit_margin":
      return computed.profit_margin == null ? "—" : formatNumber(computed.profit_margin * 100, 2) + "%";
    case "return_of_equity":
      return computed.return_of_equity == null ? "—" : formatNumber(computed.return_of_equity * 100, 2) + "%";
    case "currat":
      return computed.currat == null ? "—" : formatNumber(computed.currat, 2);
    case "workcap":
      return formatCurrency(computed.workcap, { decimals: 0 });
    default:
      return "—";
  }
}

const ROW_LABELS: { id: string; label: string }[] = [
  { id: "pldd", label: "Financial Year End" },
  { id: "bsfatot", label: FINANCIAL_FIELD_LABELS.bsfatot },
  { id: "othass", label: FINANCIAL_FIELD_LABELS.othass },
  { id: "bscatot", label: FINANCIAL_FIELD_LABELS.bscatot },
  { id: "bsclbank", label: FINANCIAL_FIELD_LABELS.bsclbank },
  { id: "totass", label: COMPUTED_FIELD_LABELS.totass },
  { id: "curlib", label: FINANCIAL_FIELD_LABELS.curlib },
  { id: "bsslltd", label: FINANCIAL_FIELD_LABELS.bsslltd },
  { id: "bsclstd", label: FINANCIAL_FIELD_LABELS.bsclstd },
  { id: "totlib", label: COMPUTED_FIELD_LABELS.totlib },
  { id: "networth", label: COMPUTED_FIELD_LABELS.networth },
  { id: "bsqpuc", label: FINANCIAL_FIELD_LABELS.bsqpuc },
  { id: "turnover", label: FINANCIAL_FIELD_LABELS.turnover },
  { id: "plnpbt", label: FINANCIAL_FIELD_LABELS.plnpbt },
  { id: "plnpat", label: FINANCIAL_FIELD_LABELS.plnpat },
  { id: "plnetdiv", label: FINANCIAL_FIELD_LABELS.plnetdiv },
  { id: "plyear", label: FINANCIAL_FIELD_LABELS.plyear },
  { id: "turnover_growth", label: COMPUTED_FIELD_LABELS.turnover_growth },
  { id: "profit_margin", label: COMPUTED_FIELD_LABELS.profit_margin },
  { id: "return_of_equity", label: COMPUTED_FIELD_LABELS.return_of_equity },
  { id: "currat", label: COMPUTED_FIELD_LABELS.currat },
  { id: "workcap", label: COMPUTED_FIELD_LABELS.workcap },
];

export function ApplicationFinancialReviewComparison({
  beforeApp,
  afterApp,
  isPathChanged,
}: {
  beforeApp: {
    financial_statements?: unknown;
    issuer_organization?: {
      corporate_entities?: unknown;
      director_kyc_status?: unknown;
      director_aml_status?: unknown;
    } | null;
  };
  afterApp: typeof beforeApp;
  isPathChanged: (path: string) => boolean;
}) {
  const mockFinancialPayload = React.useMemo(
    () =>
      USE_MOCK_FINANCIAL_RESUBMIT_COMPARISON
        ? buildMockFinancialResubmitPayload(MOCK_UNAUDITED_YEAR_COUNT)
        : null,
    []
  );

  const effectiveBeforeApp = React.useMemo(() => {
    if (!mockFinancialPayload) return beforeApp;
    return { ...beforeApp, financial_statements: mockFinancialPayload.before };
  }, [beforeApp, mockFinancialPayload]);

  const effectiveAfterApp = React.useMemo(() => {
    if (!mockFinancialPayload) return afterApp;
    return { ...afterApp, financial_statements: mockFinancialPayload.after };
  }, [afterApp, mockFinancialPayload]);

  const effectiveIsPathChanged = React.useCallback(
    (path: string) => {
      if (mockFinancialPayload && path.startsWith("financial_statements")) {
        return mockFinancialPayload.changedPaths.has(path);
      }
      return isPathChanged(path);
    },
    [isPathChanged, mockFinancialPayload]
  );

  const beforeByYear = React.useMemo(
    () => extractQuestionnaireAndUnaudited(effectiveBeforeApp.financial_statements).unauditedByYear,
    [effectiveBeforeApp.financial_statements]
  );
  const afterByYear = React.useMemo(
    () => extractQuestionnaireAndUnaudited(effectiveAfterApp.financial_statements).unauditedByYear,
    [effectiveAfterApp.financial_statements]
  );
  const beforeUnauditedKeys = React.useMemo(() => sortedUnauditedYearKeys(beforeByYear), [beforeByYear]);
  const afterUnauditedKeys = React.useMemo(() => sortedUnauditedYearKeys(afterByYear), [afterByYear]);
  const unauditedSlots = React.useMemo(
    () => buildUnauditedSlots(beforeUnauditedKeys, afterUnauditedKeys),
    [beforeUnauditedKeys, afterUnauditedKeys]
  );

  const tableMinWidth =
    unauditedSlots.length <= 1 ? "min-w-[560px]" : "min-w-[880px]";

  return (
    <>
      <ReviewFieldBlock title="Financial Summary">
        {unauditedSlots.length === 0 ? (
          <p className={reviewEmptyStateClass}>No unaudited financial data in these snapshots.</p>
        ) : (
          <div className={applicationTableWrapperClass}>
            <div className="overflow-x-auto">
              <Table
                className={cn("table-fixed w-full text-[15px]", tableMinWidth)}
                aria-label="Unaudited figures by financial metric, before and after resubmit"
              >
                <TableHeader className={cn(applicationTableHeaderBgClass, "[&_tr]:border-b-border")}>
                  <TableRow className="hover:bg-transparent border-b border-border">
                    <TableHead
                      rowSpan={2}
                      scope="col"
                      className={cn(
                        applicationTableHeaderClass,
                        "w-[22%] min-w-[120px] border-r border-border bg-muted/30 align-middle font-normal"
                      )}
                    >
                      <span className="sr-only">Financial metric</span>
                    </TableHead>
                    {unauditedSlots.map((_, si) => (
                      <TableHead
                        key={`g-${si}`}
                        colSpan={2}
                        className={cn(
                          applicationTableHeaderClass,
                          "border-r border-border text-center last:border-r-0"
                        )}
                      >
                        <span className="font-semibold text-foreground">
                          Unaudited {unauditedSlots.length > 1 ? `(${si + 1} of 2)` : ""}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="hover:bg-transparent border-b border-border">
                    {unauditedSlots.flatMap((_, si) => [
                      <TableHead
                        key={`${si}-bef`}
                        className={cn(
                          applicationTableHeaderClass,
                          "w-[19%] border-r border-border text-right tabular-nums text-muted-foreground"
                        )}
                      >
                        Before
                      </TableHead>,
                      <TableHead
                        key={`${si}-aft`}
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
                  {ROW_LABELS.map((row) => {
                    const anySlotChanged = unauditedSlots.some((slot) =>
                      rowMarkedChangedFinancial(row.id, slot, effectiveIsPathChanged)
                    );
                    return (
                      <TableRow key={row.id} className={applicationTableRowClass}>
                        <TableCell
                          className={cn(
                            applicationTableCellClass,
                            "border-r border-border bg-muted/20 font-medium text-foreground"
                          )}
                        >
                          {row.label}
                          {anySlotChanged ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">· Diff</span>
                          ) : null}
                        </TableCell>
                        {unauditedSlots.flatMap((slot, si) => {
                          const beforeFs = slot.beforeYear
                            ? (beforeByYear[slot.beforeYear] as Record<string, unknown> | undefined) ?? null
                            : null;
                          const afterFs = slot.afterYear
                            ? (afterByYear[slot.afterYear] as Record<string, unknown> | undefined) ?? null
                            : null;
                          const b = formatIssuerFinancialCell(row.id, beforeFs);
                          const a = formatIssuerFinancialCell(row.id, afterFs);
                          const differs = financialCellsDiffer(b, a);
                          return [
                            <TableCell
                              key={`${si}-b`}
                              className={cn(
                                applicationTableCellClass,
                                "border-r border-border text-right tabular-nums text-muted-foreground",
                                differs && cn(comparisonSurfaceChangedBeforeClass, "rounded-none")
                              )}
                            >
                              <span
                                className={cn(
                                  differs &&
                                    b !== "—" &&
                                    "line-through decoration-muted-foreground/80 decoration-1 [text-decoration-skip-ink:none]"
                                )}
                              >
                                {b}
                              </span>
                            </TableCell>,
                            <TableCell
                              key={`${si}-a`}
                              className={cn(
                                applicationTableCellClass,
                                "border-r border-border text-right tabular-nums text-foreground last:border-r-0",
                                differs && cn(comparisonSurfaceChangedAfterClass, "rounded-none")
                              )}
                            >
                              {a}
                            </TableCell>,
                          ];
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </ReviewFieldBlock>
    </>
  );
}
