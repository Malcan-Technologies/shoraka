"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReviewFieldBlock } from "@/components/application-review/review-field-block";
import {
  REVIEW_EMPTY_LABEL,
  reviewEmptyStateClass,
  reviewLabelClass,
  reviewRowGridClass,
  reviewValueClass,
} from "@/components/application-review/review-section-styles";
import {
  orgHref,
  orgPeopleAccessHref,
} from "@/lib/admin-directory-hrefs";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  applicationTableHeaderClass,
  applicationTableHeaderBgClass,
  applicationTableRowClass,
  applicationTableCellClass,
  applicationTableWrapperClass,
} from "@/components/application-review/application-table-styles";
import { cn } from "@/lib/utils";
import { DirectorShareholderTable } from "@/components/admin/director-shareholder-table";
import { formatCurrency, formatNumber } from "@cashsouk/config";
import { ChevronDownIcon, ChevronRightIcon, PencilSquareIcon, PlusIcon } from "@heroicons/react/24/outline";
import {
  computeColumnMetrics,
  computeEbit,
  computeInterestCoverage,
  computeCurrentRatio,
  computeNetWorth,
  computeTotalAssets,
  computeTotalLiabilities,
  computeNetDebtEquity,
  computePayablesDays,
  computeQuickRatio,
  computeReceivablesDays,
  computeDscr,
  computeWorkingCapital,
  computeTurnoverGrowth,
  financialFormToBsPl,
  computeHasPendingDirectorShareholder,
  normalizeDirectorShareholderIdKey,
  resolveCtosCurrentRatio,
  resolveCtosGearingRatio,
  resolveCtosReturnOnAssetsPercent,
  resolveCtosPatMarginPercent,
  resolveCtosReturnOnEquityPercent,
  resolveCtosTotalAssetTurnover,
  resolveCtosTotalAssets,
  resolveCtosTotalLiabilities,
  resolveFinancialSummaryIssuerReturnOnEquityRatio,
  financialFieldSourceBadge,
  getEligibleAdminInputYears,
  isAdminEditableRawFinancialKey,
  isCalculatedFinancialMetricKey,
  receivablesDaysUnavailableReason,
  resolveAdminFinancialReviewColumns,
  isCompleteIssuerMarcAssessment,
  isMarcSmeGrade,
  MARC_ASSESSMENT_REQUIRED_MESSAGE,
  marcOfficialRiskProfile,
  type ApplicationPersonRow,
  type ColumnComputedMetrics,
  type FinancialStatementsInput,
  type MarcAssessmentSnapshot,
} from "@cashsouk/types";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { applicationsKeys } from "@/applications/query-keys";
import { AdminAddFinancialStatementDialog } from "@/notes/prospectus-review/admin-add-financial-statement-dialog";
import { AdminEditFinancialFieldDialog } from "@/notes/prospectus-review/admin-edit-financial-field-dialog";
import { AdminEditFinancialStatementDialog } from "@/notes/prospectus-review/admin-edit-financial-statement-dialog";
import { format, isValid, parse, parseISO } from "date-fns";
import { useCreateApplicationCtosSubjectReport } from "@/hooks/use-admin-issuer-organization-ctos-mutations";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDirectorShareholderReviewHint } from "@/lib/admin-director-shareholder-review-message";
import {
  adminFinancialSummaryColumns,
  adminFyPeriodLines,
  adminUnauditedYearPresentation,
  extractQuestionnaireUnauditedAndAdminInput,
} from "@/lib/stored-unaudited-years";

import {
  getReturnOfEquityMissingReason,
  resolveNetWorthFromComponentsForRoe,
} from "./application-financial-review-roe-fallback";

export { extractQuestionnaireAndUnaudited } from "@/lib/stored-unaudited-years";

/** Year row placeholder when no year (em dash). */
const HEADER_PLACEHOLDER = "\u2014";
const CANNOT_CALCULATE_LABEL = "Cannot calculate";

function AdminUnauditedYearHeading({
  year,
  questionnaire,
}: {
  year: number;
  questionnaire: Parameters<typeof adminUnauditedYearPresentation>[0];
}) {
  const lines = adminFyPeriodLines(adminUnauditedYearPresentation(questionnaire, year).periodLine);
  if (lines.length === 0) return null;

  return (
    <span className="text-meta font-normal leading-snug text-muted-foreground">
      {lines.map((line) => (
        <span key={line} className="block break-words">
          {line}
        </span>
      ))}
    </span>
  );
}

type CtosFetchState = "not_pulled" | "no_records" | "has_data";

/** Show financial dates with dashes (d-M-yyyy) for CTOS and user table columns. */
function formatFinancialDateDisplay(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === "") return "\u2014";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = parseISO(s);
    if (isValid(d)) return format(d, "d-M-yyyy");
  }
  try {
    const dmy = parse(s, "d/M/yyyy", new Date());
    if (isValid(dmy)) return format(dmy, "d-M-yyyy");
  } catch {
    /* ignore */
  }
  try {
    const d2 = parse(s, "dd/MM/yyyy", new Date());
    if (isValid(d2)) return format(d2, "d-M-yyyy");
  } catch {
    /* ignore */
  }
  try {
    const dDash = parse(s, "d-M-yyyy", new Date());
    if (isValid(dDash)) return format(dDash, "d-M-yyyy");
  } catch {
    /* ignore */
  }
  try {
    const dDash2 = parse(s, "dd-MM-yyyy", new Date());
    if (isValid(dDash2)) return format(dDash2, "d-M-yyyy");
  } catch {
    /* ignore */
  }
  return s;
}

function financialSummaryColumnShellClass(
  kind: "ctos" | "unaudited" | "admin_input" | "admin_fallback_placeholder" | "empty",
  colIndex: number,
  year: number | null,
  extra?: string
) {
  const isFirstUnaudited = kind === "unaudited" && colIndex === 3;
  const emptySlot = kind === "empty" && year == null;
  return cn(
    kind === "admin_fallback_placeholder"
      ? "bg-muted/30 opacity-70"
      : kind === "unaudited"
        ? "bg-amber-50/20 dark:bg-amber-950/15"
        : kind === "ctos"
          ? "bg-muted/10"
          : "bg-background/80",
    isFirstUnaudited && "border-l-2 border-l-border",
    emptySlot && "bg-muted/30 opacity-70",
    extra
  );
}

/** One year row from CTOS `financials_json` (parser matches ctos.new.ts harness). */
interface CtosFinRow {
  financial_year: number | null;
  dates: { pldd: string | null; bsdd: string | null };
  account: Record<string, number | null>;
}

function toNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export function parseFinancialStatements(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  if (
    obj.questionnaire != null &&
    typeof obj.questionnaire === "object" &&
    obj.unaudited_by_year != null &&
    typeof obj.unaudited_by_year === "object" &&
    !Array.isArray(obj.unaudited_by_year)
  ) {
    return {};
  }
  const nested = obj.input as Record<string, unknown> | undefined;
  if (nested && typeof nested === "object") return nested as Record<string, unknown>;
  return obj;
}

export function firstUnauditedYearFinancialBlock(raw: unknown): Record<string, unknown> {
  const { unauditedByYear } = extractQuestionnaireUnauditedAndAdminInput(raw);
  const years = Object.keys(unauditedByYear).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  if (years.length === 0) return {};
  const block = unauditedByYear[years[0]];
  return block && typeof block === "object" ? (block as Record<string, unknown>) : {};
}

function ctosFinToFs(r: CtosFinRow): Record<string, unknown> {
  const a = r.account;
  const n = (k: string) => (a[k] != null ? a[k] : "");
  return {
    pldd: r.dates.pldd ?? "",
    bsfatot: n("bsfatot"),
    othass: n("othass"),
    bscatot: n("bscatot"),
    bsclbank: n("bsclbank"),
    totass: n("totass"),
    curlib: n("curlib"),
    bsslltd: n("bsslltd"),
    bsclstd: n("bsclstd"),
    totlib: n("totlib"),
    bsqpuc: n("bsqpuc"),
    turnover: n("turnover"),
    plnpbt: n("plnpbt"),
    plnpat: n("plnpat"),
    plnetdiv: n("plnetdiv"),
    plyear: n("plyear"),
    networth: n("networth"),
    turnover_growth: n("turnover_growth"),
    profit_margin: n("profit_margin"),
    return_on_equity: n("return_on_equity"),
    currat: n("currat"),
    workcap: n("workcap"),
  };
}

/**
 * SECTION: CTOS-first summary cells
 * WHY: CTOS columns use direct CTOS fields or official XSL only (never CashSouk component fallbacks)
 * INPUT: Flat row from `ctosFinToFs`
 * OUTPUT: Whether key has a finite numeric value (0 counts as present)
 * WHERE USED: `renderRowCell` when column `kind === "ctos"`
 */
function ctosFlatNumericPresent(fs: Record<string, unknown>, key: string): boolean {
  const v = fs[key];
  if (v === null || v === undefined || v === "") return false;
  return Number.isFinite(toNum(v));
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
    networth: fs.networth == null || fs.networth === "" ? undefined : toNum(fs.networth),
    totass: fs.totass == null || fs.totass === "" ? undefined : toNum(fs.totass),
    totlib: fs.totlib == null || fs.totlib === "" ? undefined : toNum(fs.totlib),
    turnover: toNum(fs.turnover),
    plnpat: toNum(fs.plnpat),
  };
}

interface ApplicationFinancialReviewContentProps {
  applicationId: string;
  issuerOrganizationId: string | null;
  app: {
    people?: ApplicationPersonRow[];
    directorShareholderListSource?: import("@cashsouk/types").DirectorShareholderListSource;
    ctosDirectorShareholderWarning?: string | null;
    issuer_organization?: {
      latest_organization_ctos_company_json?: unknown | null;
      latest_organization_ctos_financials_json?: unknown | null;
      latest_organization_ctos_report_id?: string | null;
      latest_organization_ctos_fetched_at?: string | null;
      latest_organization_ctos_has_report_html?: boolean | null;
      latest_organization_ctos_subject_reports?: Array<{
        id: string;
        subject_ref: string | null;
        fetched_at: string;
        has_report_html: boolean;
      }> | null;
      marcAssessment?: MarcAssessmentSnapshot | null;
      corporate_entities?: unknown;
    } | null;
    financial_statements?: unknown;
  };
}

export function ApplicationFinancialReviewContent({
  applicationId,
  issuerOrganizationId,
  app,
}: ApplicationFinancialReviewContentProps) {
  const issuerOrgId = issuerOrganizationId?.trim() ?? "";
  const { can } = usePermissions();
  const canManageFinancialCtos = can("applications.financial.manage");
  const canViewOrganizations = can("organizations.view");
  const createSubjectReport = useCreateApplicationCtosSubjectReport(applicationId || undefined);
  const [subjectCtosFetchKey, setSubjectCtosFetchKey] = React.useState<string | null>(null);

  const queryClient = useQueryClient();
  const [addFinancialStatementOpen, setAddFinancialStatementOpen] = React.useState(false);
  const [addFinancialStatementYear, setAddFinancialStatementYear] = React.useState<number | null>(null);
  const [editFinancialStatementOpen, setEditFinancialStatementOpen] = React.useState(false);
  const [editFinancialStatementYear, setEditFinancialStatementYear] = React.useState<number | null>(null);
  const [fieldEdit, setFieldEdit] = React.useState<{
    year: number;
    key: string;
    label: string;
    value: number | null;
  } | null>(null);

  const onAddFinancialStatementSaved = React.useCallback(() => {
    if (!applicationId) return;
    queryClient.invalidateQueries({ queryKey: applicationsKeys.detail(applicationId) });
    setAddFinancialStatementOpen(false);
  }, [applicationId, queryClient, setAddFinancialStatementOpen]);

  const onEditFinancialStatementSaved = React.useCallback(() => {
    if (!applicationId) return;
    queryClient.invalidateQueries({ queryKey: applicationsKeys.detail(applicationId) });
    setEditFinancialStatementOpen(false);
    setEditFinancialStatementYear(null);
  }, [applicationId, queryClient, setEditFinancialStatementOpen, setEditFinancialStatementYear]);

  const { unauditedByYear, adminInputByYear, questionnaire: financialQuestionnaire } = React.useMemo(
    () => extractQuestionnaireUnauditedAndAdminInput(app.financial_statements),
    [app.financial_statements]
  );

  const hasPendingDirectorShareholder = computeHasPendingDirectorShareholder(app.people);
  const hasStoredFinancialData = Object.keys(unauditedByYear).length > 0 || Object.keys(adminInputByYear).length > 0;

  const financialRows: CtosFinRow[] = React.useMemo(() => {
    const raw = app.issuer_organization?.latest_organization_ctos_financials_json;
    if (!raw || !Array.isArray(raw)) return [];
    return raw as CtosFinRow[];
  }, [app.issuer_organization?.latest_organization_ctos_financials_json]);

  const ctosFetchState = React.useMemo((): CtosFetchState => {
    if (!app.issuer_organization?.latest_organization_ctos_report_id) return "not_pulled";
    if (financialRows.length === 0) return "no_records";
    return "has_data";
  }, [app.issuer_organization?.latest_organization_ctos_report_id, financialRows.length]);

  const byYear = React.useMemo(() => {
    const m = new Map<number, CtosFinRow>();
    for (const r of financialRows) {
      if (r.financial_year != null) m.set(r.financial_year, r);
    }
    return m;
  }, [financialRows]);

  const eligibleAdminInputYears = React.useMemo(
    () =>
      getEligibleAdminInputYears({
        financialStatements: app.financial_statements,
        ctosFinancials: financialRows,
        ref: new Date(),
      }),
    [app.financial_statements, financialRows]
  );

  const columns = React.useMemo(
    () =>
      adminFinancialSummaryColumns(financialRows, unauditedByYear, adminInputByYear, eligibleAdminInputYears),
    [financialRows, unauditedByYear, adminInputByYear, eligibleAdminInputYears]
  );

  const resolvedByYear = React.useMemo(() => {
    const resolved = resolveAdminFinancialReviewColumns({
      financialStatements: app.financial_statements,
      ctosFinancials: financialRows,
      eligibleAdminInputYears,
    });
    return new Map(resolved.map((column) => [column.year, column]));
  }, [app.financial_statements, financialRows, eligibleAdminInputYears]);

  // For issuer-entered additional regulatory financial details, CTOS never provides values for these keys.
  // So render only the issuer (unaudited) columns to avoid a misleading CTOS-vs-issuer comparison layout.
  const issuerDetailColumnIndices = React.useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < columns.length; i++) {
      const spec = columns[i];
      if (spec.kind === "unaudited" && spec.year != null) indices.push(i);
    }
    return indices;
  }, [columns]);

  const turnovers = React.useMemo(() => {
    return columns.map((spec) => {
      if (spec.year == null) return { year: null as number | null, turnover: null as number | null };
      if (spec.kind === "ctos") {
        const row = byYear.get(spec.year);
        return { year: spec.year, turnover: row?.account.turnover ?? null };
      }
      const resolvedTurnover = resolvedByYear.get(spec.year)?.fields.turnover?.value ?? null;
      if (resolvedTurnover != null) return { year: spec.year, turnover: resolvedTurnover };
      const rawByYear =
        spec.kind === "admin_input" ? adminInputByYear : unauditedByYear;
      const fs = rawByYear[String(spec.year)];
      const rawT = fs?.turnover;
      const t =
        rawT != null && rawT !== "" && String(rawT).trim() !== ""
          ? toNum(rawT)
          : null;
      return { year: spec.year, turnover: hasStoredFinancialData ? t : null };
    });
  }, [columns, byYear, unauditedByYear, adminInputByYear, hasStoredFinancialData, resolvedByYear]);

  /** Calendar-year turnover for growth (do not use the physical column to the left — gaps/null CTOS slots broke YoY). */
  const turnoverByYear = React.useMemo(() => {
    const m = new Map<number, number | null>();
    columns.forEach((spec, i) => {
      if (spec.year == null) return;
      m.set(spec.year, turnovers[i]?.turnover ?? null);
    });
    return m;
  }, [columns, turnovers]);

  const columnMetrics = React.useMemo((): (ColumnComputedMetrics | null)[] => {
    return columns.map((spec) => {
      const y = spec.year;
      const g =
        y == null
          ? null
          : computeTurnoverGrowth({
              targetYear: y,
              targetTurnover: turnoverByYear.get(y) ?? null,
              priorYear: y - 1,
              priorTurnover: turnoverByYear.get(y - 1) ?? null,
            });

      // CTOS columns: never derive via component sums / PAT÷equity — official direct/XSL only in renderRowCell.
      if (spec.kind === "ctos") return null;

      if (spec.year == null) return null;
      if (!hasStoredFinancialData) return null;
      const raw =
        spec.kind === "admin_input"
          ? adminInputByYear[String(spec.year)]
          : spec.kind === "unaudited"
            ? unauditedByYear[String(spec.year)]
            : undefined;
      if (!raw) return null;
      const resolved = resolvedByYear.get(spec.year);
      const fs: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
      if (resolved) {
        for (const [key, field] of Object.entries(resolved.fields)) {
          if (field.value != null) fs[key] = field.value;
        }
      }
      const input = financialRecordToInput(fs as Record<string, unknown>);
      const { bs, pl } = financialFormToBsPl(input);
      const metrics = computeColumnMetrics(bs, pl, g);
      // Issuer Application ROE from submitted PAT ÷ Net Worth (not CTOS, not Paid-Up Capital).
      return {
        ...metrics,
        return_of_equity: resolveFinancialSummaryIssuerReturnOnEquityRatio({
          plnpat: pl.profit_after_tax,
          netWorth: metrics.networth,
        }),
      };
    });
  }, [columns, turnoverByYear, hasStoredFinancialData, unauditedByYear, adminInputByYear, resolvedByYear]);

  const getFsCol = React.useCallback(
    (idx: number): Record<string, unknown> | null => {
      const spec = columns[idx];
      if (!spec || spec.year == null) return null;
      let base: Record<string, unknown> | null = null;
      if (spec.kind === "ctos") {
        const row = byYear.get(spec.year);
        base = row ? ctosFinToFs(row) : null;
      } else if (spec.kind === "unaudited") {
        const fs = unauditedByYear[String(spec.year)];
        base = (fs && typeof fs === "object" ? fs : null) as Record<string, unknown> | null;
      } else if (spec.kind === "admin_input") {
        const fs = adminInputByYear[String(spec.year)];
        base = (fs && typeof fs === "object" ? fs : null) as Record<string, unknown> | null;
      }
      if (!base) return null;
      const resolved = resolvedByYear.get(spec.year);
      if (!resolved) return base;
      const copy = { ...base };
      for (const [key, field] of Object.entries(resolved.fields)) {
        if (field.value != null) copy[key] = field.value;
      }
      return copy;
    },
    [columns, byYear, unauditedByYear, adminInputByYear, resolvedByYear]
  );

  const ctosColumnMissing = React.useCallback(
    (colIdx: number) => {
      const spec = columns[colIdx];
      return spec?.kind === "ctos" && spec.year != null && !byYear.get(spec.year);
    },
    [columns, byYear]
  );

  const formatCell = (
    colIdx: number,
    _naAllowed: boolean,
    valueMissing: boolean,
    fmt: () => string
  ): string => {
    if (ctosColumnMissing(colIdx)) return "—";
    if (valueMissing) return "—";
    return fmt();
  };

  /** Short hint under label for computed rows (admin scan speed). */
  type FinancialCategoryId =
    | "assets"
    | "liabilities"
    | "equity"
    | "profitLoss"
    | "costs"
    | "cashFlowDebt"
    | "calculatedMetrics";

  const FINANCIAL_CATEGORY_ORDER: Array<{
    id: FinancialCategoryId;
    title: string;
    rowIds: string[];
  }> = [
    {
      id: "assets",
      title: "Assets",
      rowIds: [
        "bsfatot",
        "othass",
        "bscatot",
        "bsclbank",
        "cashAndBank",
        "tradeReceivables",
        "totass",
      ],
    },
    {
      id: "liabilities",
      title: "Liabilities",
      rowIds: [
        "curlib",
        "bsslltd",
        "bsclstd",
        "curlib_borrowing",
        "curlib_non_borrowing",
        "ncl_loan",
        "ncl_non_loan",
        "tradePayables",
        "totlib",
      ],
    },
    {
      id: "equity",
      title: "Equity",
      rowIds: [
        "bsqpuc",
        "equity_share_application",
        "equity_share_premium",
        "equity_accumulated_profit",
        "equity_minority",
        "networth",
      ],
    },
    {
      id: "profitLoss",
      title: "Profit & Loss",
      rowIds: [
        "turnover",
        "grossProfit",
        "ebitda",
        "ebit",
        "plnpbt",
        "plnpat",
        "plnetdiv",
        "pl_minority",
        "plyear",
        "netOperatingIncome",
      ],
    },
    {
      id: "costs",
      title: "Costs",
      rowIds: ["costOfSales", "operating_cost", "admin_cost", "interest_cost", "other_cost"],
    },
    {
      id: "cashFlowDebt",
      title: "Cash Flow / Debt",
      rowIds: ["operatingCashFlow", "freeCashFlow", "annualDebtService"],
    },
    {
      id: "calculatedMetrics",
      title: "Financial Ratios & Metrics",
      rowIds: [
        "turnover_growth",
        "profit_margin",
        "currat",
        "quickRatio",
        "workcap",
        "return_of_equity",
        "roa",
        "assetTurnover",
        "gear",
        "debtEquityPercent",
        "netDebtEquity",
        "interestCoverage",
        "receivablesDays",
        "payablesDays",
        "dscr",
      ],
    },
  ];

  const FINANCIAL_ROW_META: Record<
    string,
    { label: string; formulaHint?: string; isTotal?: boolean }
  > = {
    pldd: { label: "Financial Year End" },
    bsfatot: { label: "Fixed Assets" },
    othass: { label: "Other Assets" },
    bscatot: { label: "Current Assets" },
    bsclbank: { label: "Non-current Assets" },
    cashAndBank: { label: "Cash & Bank" },
    tradeReceivables: { label: "Trade Receivables" },
    totass: {
      label: "Total Assets",
      formulaHint: "Sum of asset figures",
      isTotal: true,
    },
    curlib: { label: "Current Liabilities" },
    bsslltd: { label: "Long-term Liabilities" },
    bsclstd: { label: "Non-current Liabilities" },
    curlib_borrowing: { label: "Current Borrowings" },
    curlib_non_borrowing: { label: "Other Current Liabilities" },
    ncl_loan: { label: "Non-current Loans" },
    ncl_non_loan: { label: "Other Non-current Liabilities" },
    tradePayables: { label: "Trade Payables" },
    totlib: {
      label: "Total Liabilities",
      formulaHint: "Sum of liability figures",
      isTotal: true,
    },
    bsqpuc: { label: "Paid-up Share Capital" },
    equity_share_application: { label: "Share Application Account (if applicable)" },
    equity_share_premium: { label: "Share Premium & Other Reserves (if applicable)" },
    equity_accumulated_profit: { label: "Accumulated Profit / Loss" },
    equity_minority: { label: "Equity Minority Interest (if applicable)" },
    networth: {
      label: "Total Equity / Net Worth",
      formulaHint: "Total Assets − Total Liabilities",
      isTotal: true,
    },
    turnover: { label: "Revenue / Turnover" },
    grossProfit: { label: "Gross Profit" },
    ebitda: { label: "EBITDA" },
    plnpbt: { label: "Profit / Loss Before Tax" },
    plnpat: { label: "Profit / Loss After Tax" },
    plnetdiv: { label: "Net Dividend" },
    pl_minority: { label: "P&L Minority Interest" },
    plyear: { label: "Profit / Loss of Year" },
    netOperatingIncome: { label: "Net Operating Income" },
    costOfSales: { label: "Cost of Sales" },
    operating_cost: { label: "Operating Costs" },
    admin_cost: { label: "Administrative Costs" },
    interest_cost: { label: "Interest Costs" },
    other_cost: { label: "Other Costs" },
    operatingCashFlow: { label: "Operating Cash Flow" },
    freeCashFlow: { label: "Free Cash Flow" },
    annualDebtService: { label: "Annual Debt Service" },
    ebit: { label: "EBIT", formulaHint: "Profit / Loss Before Tax + Interest Costs" },
    turnover_growth: {
      label: "Turnover Growth",
      formulaHint: "Change in Revenue compared with the previous financial year",
    },
    profit_margin: {
      label: "Net Profit Margin / PAT Margin",
      formulaHint: "Profit After Tax ÷ Revenue",
    },
    currat: { label: "Current Ratio", formulaHint: "Current Assets ÷ Current Liabilities" },
    quickRatio: {
      label: "Quick Ratio",
      formulaHint: "(Cash & Bank + Trade Receivables) ÷ Current Liabilities",
    },
    workcap: {
      label: "Working Capital",
      formulaHint: "Current Assets − Current Liabilities",
    },
    return_of_equity: {
      label: "Return on Equity (ROE)",
      formulaHint: "Profit After Tax ÷ Net Worth",
    },
    roa: {
      label: "Return on Assets (ROA)",
      formulaHint: "Profit After Tax ÷ Total Assets",
    },
    assetTurnover: {
      label: "Asset Turnover",
      formulaHint: "Revenue ÷ Total Assets",
    },
    gear: {
      label: "Debt / Equity",
      formulaHint: "Total Liabilities ÷ Net Worth",
    },
    debtEquityPercent: {
      label: "Gearing",
      formulaHint: "Total Liabilities ÷ Net Worth",
    },
    netDebtEquity: {
      label: "Net Debt / Equity",
      formulaHint: "(Current Borrowings + Non-current Loans − Cash & Bank) ÷ Net Worth",
    },
    interestCoverage: {
      label: "Interest Coverage",
      formulaHint: "EBIT ÷ Interest Costs",
    },
    receivablesDays: {
      label: "Receivables Days",
      formulaHint: "Average Trade Receivables ÷ Revenue × 365",
    },
    payablesDays: {
      label: "Payables Days",
      formulaHint: "Trade Payables ÷ Cost of Sales × 365",
    },
    dscr: {
      label: "DSCR",
      formulaHint: "Net Operating Income ÷ Annual Debt Service",
    },
  };

  const [openCategories, setOpenCategories] = React.useState<Record<FinancialCategoryId, boolean>>({
    assets: true,
    liabilities: true,
    equity: false,
    profitLoss: true,
    costs: false,
    cashFlowDebt: false,
    calculatedMetrics: true,
  });

  type TableRowItem =
    | { kind: "category"; categoryId: FinancialCategoryId; title: string }
    | { kind: "row"; rowId: string };

  const flattenedRows: TableRowItem[] = React.useMemo(() => {
    const out: TableRowItem[] = [];
    for (const cat of FINANCIAL_CATEGORY_ORDER) {
      out.push({ kind: "category", categoryId: cat.id, title: cat.title });
      if (!openCategories[cat.id]) continue;
      for (const rowId of cat.rowIds) out.push({ kind: "row", rowId });
    }
    return out;
  }, [openCategories]);

  const getRowMeta = (rowId: string) => FINANCIAL_ROW_META[rowId] ?? { label: rowId };

  const renderRowCell = (rowId: string, colIdx: number): string => {
    const specCol = columns[colIdx];
    if (!specCol) return "—";
    if (specCol.kind === "ctos") {
      if (ctosFetchState === "not_pulled" || ctosFetchState === "no_records") return "—";
    }
    if (specCol.kind === "admin_fallback_placeholder") return "—";
    if (specCol.year == null) {
      return "—";
    }

    const fs = getFsCol(colIdx);
    const computed = columnMetrics[colIdx];

    switch (rowId) {
      case "pldd":
        if (specCol.kind === "unaudited") {
          if (!fs || fs.pldd == null || String(fs.pldd).trim() === "") return "—";
          return formatFinancialDateDisplay(String(fs.pldd));
        }
        return formatCell(colIdx, true, !fs || fs.pldd == null || fs.pldd === "", () =>
          formatFinancialDateDisplay(String(fs!.pldd))
        );
      case "bsfatot":
        return formatCell(colIdx, true, !fs || fs.bsfatot == null || fs.bsfatot === "", () =>
          formatCurrency(toNum(fs!.bsfatot), { decimals: 0 })
        );
      case "othass":
        return formatCell(colIdx, true, !fs || fs.othass == null || fs.othass === "", () =>
          formatCurrency(toNum(fs!.othass), { decimals: 0 })
        );
      case "bscatot":
        return formatCell(colIdx, true, !fs || fs.bscatot == null || fs.bscatot === "", () =>
          formatCurrency(toNum(fs!.bscatot), { decimals: 0 })
        );
      case "bsclbank":
        return formatCell(colIdx, true, !fs || fs.bsclbank == null || fs.bsclbank === "", () =>
          formatCurrency(toNum(fs!.bsclbank), { decimals: 0 })
        );
      case "totass": {
        if (ctosColumnMissing(colIdx)) return "—";
        if (specCol.kind === "ctos") {
          let n = resolveCtosTotalAssets({
            totass: fs && ctosFlatNumericPresent(fs, "totass") ? toNum(fs.totass) : null,
          });
          // CTOS finished metric priority: when CTOS `totass` is missing,
          // follow the agreed Excel mapping formula (sum of asset components).
          if (n == null && specCol.year != null) {
            const yearFields = resolvedByYear.get(specCol.year)?.fields;
            n = computeTotalAssets({
              total_assets: null,
              fixed_assets: yearFields?.bsfatot?.value ?? null,
              other_assets: yearFields?.othass?.value ?? null,
              current_assets: yearFields?.bscatot?.value ?? null,
              non_current_assets: yearFields?.bsclbank?.value ?? null,
            });
          }
          if (n == null) return CANNOT_CALCULATE_LABEL;
          return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
        }
        if (!computed) return CANNOT_CALCULATE_LABEL;
        if (computed.totass == null) return CANNOT_CALCULATE_LABEL;
        const n = computed.totass;
        return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
      }
      case "curlib":
        return formatCell(colIdx, true, !fs || fs.curlib == null || fs.curlib === "", () =>
          formatCurrency(toNum(fs!.curlib), { decimals: 0 })
        );
      case "bsslltd":
        return formatCell(colIdx, true, !fs || fs.bsslltd == null || fs.bsslltd === "", () =>
          formatCurrency(toNum(fs!.bsslltd), { decimals: 0 })
        );
      case "bsclstd":
        return formatCell(colIdx, true, !fs || fs.bsclstd == null || fs.bsclstd === "", () =>
          formatCurrency(toNum(fs!.bsclstd), { decimals: 0 })
        );
      case "totlib": {
        if (ctosColumnMissing(colIdx)) return "—";
        if (specCol.kind === "ctos") {
          let n = resolveCtosTotalLiabilities({
            totlib: fs && ctosFlatNumericPresent(fs, "totlib") ? toNum(fs.totlib) : null,
          });
          // CTOS finished metric priority: when CTOS `totlib` is missing,
          // follow the agreed Excel mapping formula (sum of liability components).
          if (n == null && specCol.year != null) {
            const yearFields = resolvedByYear.get(specCol.year)?.fields;
            n = computeTotalLiabilities({
              total_liabilities: null,
              current_liabilities: yearFields?.curlib?.value ?? null,
              long_term_liabilities: yearFields?.bsslltd?.value ?? null,
              non_current_liabilities: yearFields?.bsclstd?.value ?? null,
            });
          }
          if (n == null) return CANNOT_CALCULATE_LABEL;
          return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
        }
        if (!computed) return CANNOT_CALCULATE_LABEL;
        if (computed.totlib == null) return CANNOT_CALCULATE_LABEL;
        const n = computed.totlib;
        return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
      }
      case "networth": {
        if (ctosColumnMissing(colIdx)) return "—";
        if (specCol.kind === "ctos") {
          if (fs && ctosFlatNumericPresent(fs, "networth")) {
            const raw = toNum(fs.networth);
            return raw === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(raw, { decimals: 0 });
          }

          // CTOS finished metric priority: when CTOS `networth` is missing,
          // follow the agreed Excel mapping formula (Total Assets − Total Liabilities).
          const yearFields = specCol.year != null ? resolvedByYear.get(specCol.year)?.fields : undefined;
          const totass = computeTotalAssets({
            total_assets: null,
            fixed_assets: yearFields?.bsfatot?.value ?? null,
            other_assets: yearFields?.othass?.value ?? null,
            current_assets: yearFields?.bscatot?.value ?? null,
            non_current_assets: yearFields?.bsclbank?.value ?? null,
          });
          const totlib = computeTotalLiabilities({
            total_liabilities: null,
            current_liabilities: yearFields?.curlib?.value ?? null,
            long_term_liabilities: yearFields?.bsslltd?.value ?? null,
            non_current_liabilities: yearFields?.bsclstd?.value ?? null,
          });
          if (totass == null || totlib == null) return CANNOT_CALCULATE_LABEL;
          const n = computeNetWorth(totass, totlib);
          return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
        }
        if (!computed) return CANNOT_CALCULATE_LABEL;
        if (computed.networth == null) return CANNOT_CALCULATE_LABEL;
        const n = computed.networth;
        return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
      }
      case "bsqpuc":
        return formatCell(colIdx, true, !fs || fs.bsqpuc == null || fs.bsqpuc === "", () =>
          formatCurrency(toNum(fs!.bsqpuc), { decimals: 0 })
        );
      case "turnover":
        return formatCell(colIdx, true, !fs || fs.turnover == null || fs.turnover === "", () =>
          formatCurrency(toNum(fs!.turnover), { decimals: 0 })
        );
      case "plnpbt":
        return formatCell(colIdx, true, !fs || fs.plnpbt == null || fs.plnpbt === "", () =>
          formatCurrency(toNum(fs!.plnpbt), { decimals: 0 })
        );
      case "plnpat":
        return formatCell(colIdx, true, !fs || fs.plnpat == null || fs.plnpat === "", () =>
          formatCurrency(toNum(fs!.plnpat), { decimals: 0 })
        );
      case "plnetdiv":
        return formatCell(colIdx, true, !fs || fs.plnetdiv == null || fs.plnetdiv === "", () =>
          formatCurrency(toNum(fs!.plnetdiv), { decimals: 0 })
        );
      case "plyear":
        return formatCell(colIdx, true, !fs || fs.plyear == null || fs.plyear === "", () =>
          formatCurrency(toNum(fs!.plyear), { decimals: 0 })
        );
      case "turnover_growth": {
        if (ctosColumnMissing(colIdx)) return "—";
        if (specCol.kind === "ctos") {
          if (fs && ctosFlatNumericPresent(fs, "turnover_growth")) {
            return formatNumber(toNum(fs.turnover_growth), 2) + "%";
          }

          const targetTurnover = specCol.year != null ? turnoverByYear.get(specCol.year) ?? null : null;
          const priorTurnover =
            specCol.year != null ? turnoverByYear.get(specCol.year - 1) ?? null : null;
          if (targetTurnover == null) return CANNOT_CALCULATE_LABEL;
          if (priorTurnover == null) return CANNOT_CALCULATE_LABEL;
          const g = computeTurnoverGrowth({
            targetYear: specCol.year,
            targetTurnover,
            priorYear: specCol.year - 1,
            priorTurnover,
          });
          if (g == null) return CANNOT_CALCULATE_LABEL;
          return formatNumber(g * 100, 2) + "%";
        }
        if (!computed || computed.turnover_growth == null) {
          const targetTurnover = specCol.year != null ? turnoverByYear.get(specCol.year) ?? null : null;
          const priorTurnover =
            specCol.year != null ? turnoverByYear.get(specCol.year - 1) ?? null : null;
          if (priorTurnover == null) return CANNOT_CALCULATE_LABEL;
          if (targetTurnover == null) return CANNOT_CALCULATE_LABEL;
          return CANNOT_CALCULATE_LABEL;
        }
        return formatNumber(computed.turnover_growth * 100, 2) + "%";
      }
      case "profit_margin": {
        if (ctosColumnMissing(colIdx)) return "—";
        // CTOS: official PAT Margin XSL. Never CTOS profit_margin (PBT Margin).
        if (specCol.kind === "ctos") {
          const row = byYear.get(specCol.year);
          const percent = resolveCtosPatMarginPercent({
            plnpat: row?.account.plnpat ?? null,
            turnover: row?.account.turnover ?? null,
          });
          if (percent == null) return CANNOT_CALCULATE_LABEL;
          return formatNumber(percent, 2) + "%";
        }
        if (!computed || computed.profit_margin == null) return CANNOT_CALCULATE_LABEL;
        return formatNumber(computed.profit_margin * 100, 2) + "%";
      }
      case "return_of_equity": {
        if (ctosColumnMissing(colIdx)) return "—";
        if (specCol.kind === "ctos") {
          const percent = resolveCtosReturnOnEquityPercent({
            return_on_equity:
              fs && ctosFlatNumericPresent(fs, "return_on_equity")
                ? toNum(fs.return_on_equity)
                : null,
          });
          if (percent != null) return formatNumber(percent, 2) + "%";

          // Fallback to the agreed issuer formula when CTOS finished metric is missing.
          const pat = resolvedByYear.get(specCol.year)?.fields.plnpat?.value ?? null;
          const yearFields = resolvedByYear.get(specCol.year)?.fields;
          const netWorthValFromFields = yearFields?.networth?.value ?? null;
          const netWorthVal =
            netWorthValFromFields ??
            resolveNetWorthFromComponentsForRoe({
              fixedAssets: yearFields?.bsfatot?.value ?? null,
              otherAssets: yearFields?.othass?.value ?? null,
              currentAssets: yearFields?.bscatot?.value ?? null,
              nonCurrentAssets: yearFields?.bsclbank?.value ?? null,
              currentLiabilities: yearFields?.curlib?.value ?? null,
              longTermLiabilities: yearFields?.bsslltd?.value ?? null,
              nonCurrentLiabilities: yearFields?.bsclstd?.value ?? null,
            });
          const roeRatio = resolveFinancialSummaryIssuerReturnOnEquityRatio({
            plnpat: pat,
            netWorth: netWorthVal,
          });
          return roeRatio == null ? CANNOT_CALCULATE_LABEL : `${formatNumber(roeRatio * 100, 2)}%`;
        }
        if (!computed || computed.return_of_equity == null) return CANNOT_CALCULATE_LABEL;
        return formatNumber(computed.return_of_equity * 100, 2) + "%";
      }
      case "currat": {
        if (ctosColumnMissing(colIdx)) return "—";
        if (specCol.kind === "ctos") {
          const n = resolveCtosCurrentRatio({
            currat: fs && ctosFlatNumericPresent(fs, "currat") ? toNum(fs.currat) : null,
          });
          if (n != null) return formatNumber(n, 2);

          // Fallback to the agreed issuer formula when CTOS finished metric is missing.
          const currentAssets = resolvedByYear.get(specCol.year)?.fields.bscatot?.value ?? null;
          const currentLiabilities = resolvedByYear.get(specCol.year)?.fields.curlib?.value ?? null;
          const ratio = computeCurrentRatio(currentAssets, currentLiabilities);
          return ratio == null ? CANNOT_CALCULATE_LABEL : formatNumber(ratio, 2);
        }
        if (!computed || computed.currat == null) return CANNOT_CALCULATE_LABEL;
        return formatNumber(computed.currat, 2);
      }
      case "workcap": {
        if (ctosColumnMissing(colIdx)) return "—";
        if (specCol.kind === "ctos") {
          if (fs && ctosFlatNumericPresent(fs, "workcap")) {
            return formatCurrency(toNum(fs.workcap), { decimals: 0 });
          }

          // Fallback to the agreed issuer formula when CTOS finished metric is missing.
          const currentAssets = resolvedByYear.get(specCol.year)?.fields.bscatot?.value ?? null;
          const currentLiabilities = resolvedByYear.get(specCol.year)?.fields.curlib?.value ?? null;
          const wc = computeWorkingCapital(currentAssets, currentLiabilities);
          return wc == null ? CANNOT_CALCULATE_LABEL : formatCurrency(wc, { decimals: 0 });
        }
        if (!computed) return CANNOT_CALCULATE_LABEL;
        if (computed.workcap == null) return CANNOT_CALCULATE_LABEL;
        return formatCurrency(computed.workcap, { decimals: 0 });
      }
      case "receivablesDays": {
        if (specCol.year == null) return "—";
        const ending = resolvedByYear.get(specCol.year)?.fields.tradeReceivables?.value ?? null;
        const prior = resolvedByYear.get(specCol.year - 1)?.fields.tradeReceivables?.value ?? null;
        const turnover = resolvedByYear.get(specCol.year)?.fields.turnover?.value ?? null;
        const reason = receivablesDaysUnavailableReason({
          year: specCol.year,
          endingTradeReceivables: ending,
          priorTradeReceivables: prior,
          turnover,
        });
        if (reason) return CANNOT_CALCULATE_LABEL;
        const days = computeReceivablesDays(prior, ending, turnover);
        return days == null ? CANNOT_CALCULATE_LABEL : formatNumber(days, 2);
      }
      case "ebit": {
        const plnpbt = resolvedByYear.get(specCol.year)?.fields.plnpbt?.value ?? null;
        const interestCost = resolvedByYear.get(specCol.year)?.fields.interest_cost?.value ?? null;
        const ebit = computeEbit(plnpbt, interestCost);
        return ebit == null ? CANNOT_CALCULATE_LABEL : formatCurrency(ebit, { decimals: 0 });
      }
      case "quickRatio": {
        const cashAndBank = resolvedByYear.get(specCol.year)?.fields.cashAndBank?.value ?? null;
        const tradeReceivables = resolvedByYear.get(specCol.year)?.fields.tradeReceivables?.value ?? null;
        const curlib = resolvedByYear.get(specCol.year)?.fields.curlib?.value ?? null;
        const q = computeQuickRatio(cashAndBank, tradeReceivables, curlib);
        return q == null ? CANNOT_CALCULATE_LABEL : formatNumber(q, 2);
      }
      case "roa": {
        if (ctosColumnMissing(colIdx)) return "—";
        if (specCol.kind === "ctos") {
          const row = byYear.get(specCol.year);
          const roaPercent = resolveCtosReturnOnAssetsPercent({
            plnpat: row?.account.plnpat ?? null,
            totass: row?.account.totass ?? null,
          });
          return roaPercent == null ? CANNOT_CALCULATE_LABEL : `${formatNumber(roaPercent, 2)}%`;
        }
        if (!computed) return CANNOT_CALCULATE_LABEL;
        const pat = resolvedByYear.get(specCol.year)?.fields.plnpat?.value ?? null;
        const totassVal = computed.totass ?? null;
        if (pat == null || totassVal == null || totassVal === 0) return CANNOT_CALCULATE_LABEL;
        const roaPercent = (pat / totassVal) * 100;
        return `${formatNumber(roaPercent, 2)}%`;
      }
      case "assetTurnover": {
        if (ctosColumnMissing(colIdx)) return "—";
        if (specCol.kind === "ctos") {
          const row = byYear.get(specCol.year);
          const v = resolveCtosTotalAssetTurnover({
            turnover: row?.account.turnover ?? null,
            totass: row?.account.totass ?? null,
          });
          return v == null ? CANNOT_CALCULATE_LABEL : `${formatNumber(v, 2)}x`;
        }
        if (!computed) return CANNOT_CALCULATE_LABEL;
        const turnover = resolvedByYear.get(specCol.year)?.fields.turnover?.value ?? null;
        const totassVal = computed.totass ?? null;
        if (turnover == null || totassVal == null || totassVal === 0) return CANNOT_CALCULATE_LABEL;
        const v = turnover / totassVal;
        return `${formatNumber(v, 2)}x`;
      }
      case "gear": {
        if (ctosColumnMissing(colIdx)) return "—";
        if (specCol.kind === "ctos") {
          const row = byYear.get(specCol.year);
          const v = resolveCtosGearingRatio({
            gear: row?.account.gear ?? null,
            totlib: row?.account.totlib ?? null,
            networth: row?.account.networth ?? null,
          });
          return v == null ? CANNOT_CALCULATE_LABEL : `${formatNumber(v, 2)}x`;
        }
        if (!computed) return CANNOT_CALCULATE_LABEL;
        if (computed.networth == null || computed.totlib == null) return CANNOT_CALCULATE_LABEL;
        if (computed.networth === 0) return CANNOT_CALCULATE_LABEL;
        const v = computed.totlib / computed.networth;
        return `${formatNumber(v, 2)}x`;
      }
      case "debtEquityPercent": {
        if (ctosColumnMissing(colIdx)) return "—";
        if (specCol.kind === "ctos") {
          const row = byYear.get(specCol.year);
          const v = resolveCtosGearingRatio({
            gear: row?.account.gear ?? null,
            totlib: row?.account.totlib ?? null,
            networth: row?.account.networth ?? null,
          });
          return v == null ? CANNOT_CALCULATE_LABEL : `${formatNumber(v, 2)}x`;
        }
        if (!computed) return CANNOT_CALCULATE_LABEL;
        if (computed.networth == null || computed.totlib == null) return CANNOT_CALCULATE_LABEL;
        if (computed.networth === 0) return CANNOT_CALCULATE_LABEL;
        const v = computed.totlib / computed.networth;
        return `${formatNumber(v, 2)}x`;
      }
      case "netDebtEquity": {
        if (ctosColumnMissing(colIdx)) return "—";
        const curlibBorrowing =
          resolvedByYear.get(specCol.year)?.fields.curlib_borrowing?.value ?? null;
        const nclLoan = resolvedByYear.get(specCol.year)?.fields.ncl_loan?.value ?? null;
        const cashAndBank = resolvedByYear.get(specCol.year)?.fields.cashAndBank?.value ?? null;
        const yearFields = resolvedByYear.get(specCol.year)?.fields;
        let networthVal =
          specCol.kind === "ctos" ? toNum(fs?.networth) : computed?.networth ?? null;

        // CTOS omission-risk: if CTOS finished Net Worth is missing, derive it from components
        // using the exact same helper path as the "Total Equity / Net Worth" row.
        if (specCol.kind === "ctos" && networthVal == null) {
          networthVal = resolveNetWorthFromComponentsForRoe({
            fixedAssets: yearFields?.bsfatot?.value ?? null,
            otherAssets: yearFields?.othass?.value ?? null,
            currentAssets: yearFields?.bscatot?.value ?? null,
            nonCurrentAssets: yearFields?.bsclbank?.value ?? null,
            currentLiabilities: yearFields?.curlib?.value ?? null,
            longTermLiabilities: yearFields?.bsslltd?.value ?? null,
            nonCurrentLiabilities: yearFields?.bsclstd?.value ?? null,
          });
        }
        const v = computeNetDebtEquity({
          curlib_borrowing: curlibBorrowing,
          ncl_loan: nclLoan,
          cashAndBank,
          networth: networthVal,
        });
        return v == null ? CANNOT_CALCULATE_LABEL : `${formatNumber(v, 2)}x`;
      }
      case "interestCoverage": {
        if (ctosColumnMissing(colIdx)) return "—";
        const plnpbt = resolvedByYear.get(specCol.year)?.fields.plnpbt?.value ?? null;
        const interestCost = resolvedByYear.get(specCol.year)?.fields.interest_cost?.value ?? null;
        const ebit = computeEbit(plnpbt, interestCost);
        const v = computeInterestCoverage(ebit, interestCost);
        return v == null ? CANNOT_CALCULATE_LABEL : `${formatNumber(v, 2)}x`;
      }
      case "payablesDays": {
        if (ctosColumnMissing(colIdx)) return "—";
        const tradePayables = resolvedByYear.get(specCol.year)?.fields.tradePayables?.value ?? null;
        const costOfSales = resolvedByYear.get(specCol.year)?.fields.costOfSales?.value ?? null;
        const v = computePayablesDays(tradePayables, costOfSales);
        return v == null ? CANNOT_CALCULATE_LABEL : formatNumber(v, 2);
      }
      case "dscr": {
        if (ctosColumnMissing(colIdx)) return "—";
        const netOperatingIncome = resolvedByYear.get(specCol.year)?.fields.netOperatingIncome?.value ?? null;
        const annualDebtService = resolvedByYear.get(specCol.year)?.fields.annualDebtService?.value ?? null;
        const v = computeDscr(netOperatingIncome, annualDebtService);
        return v == null ? CANNOT_CALCULATE_LABEL : `${formatNumber(v, 2)}x`;
      }
      default: {
        if (!isAdminEditableRawFinancialKey(rowId) || specCol.year == null) return "—";
        const field = resolvedByYear.get(specCol.year)?.fields[rowId];
        if (!field || field.value == null) {
          return "—";
        }
        return formatCurrency(field.value, { decimals: 0 });
      }
    }
  };

  const getCalculatedHelperText = (rowId: string, colIdx: number): string | null => {
    const specCol = columns[colIdx];
    if (!specCol || specCol.year == null) return null;
    if (specCol.kind === "admin_fallback_placeholder") return null;

    const year = specCol.year;
    const fs = specCol.kind === "ctos" ? getFsCol(colIdx) : null;
    const yearFields = resolvedByYear.get(year)?.fields;

    switch (rowId) {
      case "ebit": {
        // EBIT = PBT + Interest Costs. We never ask Admin to type EBIT directly.
        const pbt = resolvedByYear.get(year)?.fields.plnpbt?.value ?? null;
        const interestCosts = resolvedByYear.get(year)?.fields.interest_cost?.value ?? null;
        if (pbt == null && interestCosts == null) return "Missing required financial inputs";
        if (pbt == null) return "Missing: Profit / Loss Before Tax";
        return "Missing: Interest Costs";
      }
      case "turnover_growth": {
        if (specCol.kind === "ctos" && fs && ctosFlatNumericPresent(fs, "turnover_growth")) return null;
        const targetTurnover = turnoverByYear.get(year) ?? null;
        const priorTurnover = turnoverByYear.get(year - 1) ?? null;
        if (targetTurnover == null) return "Missing: Revenue / Turnover";
        if (priorTurnover == null) return "Missing: previous financial year Revenue / Turnover";
        return "Missing: Revenue / Turnover";
      }
      case "receivablesDays": {
        const ending = resolvedByYear.get(year)?.fields.tradeReceivables?.value ?? null;
        const prior = resolvedByYear.get(year - 1)?.fields.tradeReceivables?.value ?? null;
        const turnover = resolvedByYear.get(year)?.fields.turnover?.value ?? null;
        const reason = receivablesDaysUnavailableReason({
          year,
          endingTradeReceivables: ending,
          priorTradeReceivables: prior,
          turnover,
        });
        if (!reason) return null;
        if (reason.includes("previous year Trade Receivables")) {
          return "Missing: previous financial year Trade Receivables";
        }
        if (reason.includes("Trade Receivables unavailable")) {
          return "Missing: Trade Receivables";
        }
        if (reason.includes("Revenue unavailable")) {
          return "Missing: Revenue / Turnover";
        }
        return "Missing: Receivables Days";
      }
      case "interestCoverage": {
        const interestCosts = yearFields?.interest_cost?.value ?? null;
        const pbt = yearFields?.plnpbt?.value ?? null;
        if (interestCosts == null) return "Missing: Interest Costs";
        if (interestCosts === 0) return "Invalid: Interest Costs is zero";
        if (pbt == null) return "Missing: Profit / Loss Before Tax";
        return "Missing required financial inputs";
      }
      case "dscr": {
        const netOperatingIncome = yearFields?.netOperatingIncome?.value ?? null;
        const annualDebtService = yearFields?.annualDebtService?.value ?? null;
        if (annualDebtService == null) return "Missing: Annual Debt Service";
        if (annualDebtService === 0) return "Invalid: Annual Debt Service is zero";
        if (netOperatingIncome == null) return "Missing: Net Operating Income";
        return "Missing required financial inputs";
      }
      case "quickRatio": {
        const cashAndBank = yearFields?.cashAndBank?.value ?? null;
        const tradeReceivables = yearFields?.tradeReceivables?.value ?? null;
        const currentLiabilities = yearFields?.curlib?.value ?? null;
        if (cashAndBank == null) return "Missing: Cash & Bank";
        if (tradeReceivables == null) return "Missing: Trade Receivables";
        if (currentLiabilities == null) return "Missing: Current Liabilities";
        if (currentLiabilities === 0) return "Invalid: Current Liabilities is zero";
        return "Missing required financial inputs";
      }
      case "currat": {
        const currentAssets = yearFields?.bscatot?.value ?? null;
        const currentLiabilities = yearFields?.curlib?.value ?? null;
        if (currentAssets == null) return "Missing: Current Assets";
        if (currentLiabilities == null) return "Missing: Current Liabilities";
        if (currentLiabilities === 0) return "Invalid: Current Liabilities is zero";
        return "Missing required financial inputs";
      }
      case "profit_margin": {
        const pat = yearFields?.plnpat?.value ?? null;
        const revenue = yearFields?.turnover?.value ?? null;
        if (pat == null) return "Missing: Profit / Loss After Tax";
        if (revenue == null) return "Missing: Revenue / Turnover";
        if (revenue === 0) return "Invalid: Revenue / Turnover is zero";
        return "Missing required financial inputs";
      }
      case "workcap": {
        const currentAssets = yearFields?.bscatot?.value ?? null;
        const currentLiabilities = yearFields?.curlib?.value ?? null;
        if (currentAssets == null) return "Missing: Current Assets";
        if (currentLiabilities == null) return "Missing: Current Liabilities";
        return "Missing required financial inputs";
      }
      case "roa": {
        const pat = yearFields?.plnpat?.value ?? null;
        if (pat == null) return "Missing: Profit / Loss After Tax";

        const computedTotalAssets = computeTotalAssets({
          total_assets: yearFields?.totass?.value ?? null,
          fixed_assets: yearFields?.bsfatot?.value ?? null,
          other_assets: yearFields?.othass?.value ?? null,
          current_assets: yearFields?.bscatot?.value ?? null,
          non_current_assets: yearFields?.bsclbank?.value ?? null,
        });
        if (computedTotalAssets == null) return "Missing: Total Assets";
        if (computedTotalAssets === 0) return "Invalid: Total Assets is zero";
        return "Missing required financial inputs";
      }
      case "assetTurnover": {
        const revenue = yearFields?.turnover?.value ?? null;
        if (revenue == null) return "Missing: Revenue / Turnover";

        const computedTotalAssets = computeTotalAssets({
          total_assets: yearFields?.totass?.value ?? null,
          fixed_assets: yearFields?.bsfatot?.value ?? null,
          other_assets: yearFields?.othass?.value ?? null,
          current_assets: yearFields?.bscatot?.value ?? null,
          non_current_assets: yearFields?.bsclbank?.value ?? null,
        });
        if (computedTotalAssets == null) return "Missing: Total Assets";
        if (computedTotalAssets === 0) return "Invalid: Total Assets is zero";
        return "Missing required financial inputs";
      }
      case "gear":
      case "debtEquityPercent": {
        const computedTotalLiabilities = computeTotalLiabilities({
          total_liabilities: yearFields?.totlib?.value ?? null,
          current_liabilities: yearFields?.curlib?.value ?? null,
          long_term_liabilities: yearFields?.bsslltd?.value ?? null,
          non_current_liabilities: yearFields?.bsclstd?.value ?? null,
        });
        if (computedTotalLiabilities == null) return "Missing: Total Liabilities";

        const computedNetWorth =
          yearFields?.networth?.value ??
          resolveNetWorthFromComponentsForRoe({
            fixedAssets: yearFields?.bsfatot?.value ?? null,
            otherAssets: yearFields?.othass?.value ?? null,
            currentAssets: yearFields?.bscatot?.value ?? null,
            nonCurrentAssets: yearFields?.bsclbank?.value ?? null,
            currentLiabilities: yearFields?.curlib?.value ?? null,
            longTermLiabilities: yearFields?.bsslltd?.value ?? null,
            nonCurrentLiabilities: yearFields?.bsclstd?.value ?? null,
          });
        if (computedNetWorth == null) return "Missing: Total Equity / Net Worth";
        if (computedNetWorth === 0) return "Invalid: Total Equity / Net Worth is zero";

        return "Missing required financial inputs";
      }
      case "netDebtEquity": {
        const curlibBorrowing = yearFields?.curlib_borrowing?.value ?? null;
        const nclLoan = yearFields?.ncl_loan?.value ?? null;
        const cashAndBank = yearFields?.cashAndBank?.value ?? null;
        const netWorthComputed =
          yearFields?.networth?.value ??
          resolveNetWorthFromComponentsForRoe({
            fixedAssets: yearFields?.bsfatot?.value ?? null,
            otherAssets: yearFields?.othass?.value ?? null,
            currentAssets: yearFields?.bscatot?.value ?? null,
            nonCurrentAssets: yearFields?.bsclbank?.value ?? null,
            currentLiabilities: yearFields?.curlib?.value ?? null,
            longTermLiabilities: yearFields?.bsslltd?.value ?? null,
            nonCurrentLiabilities: yearFields?.bsclstd?.value ?? null,
          });

        if (curlibBorrowing == null) return "Missing: Current Borrowings";
        if (nclLoan == null) return "Missing: Non-current Loans";
        if (cashAndBank == null) return "Missing: Cash & Bank";
        if (netWorthComputed == null) return "Missing: Total Equity / Net Worth";
        if (netWorthComputed === 0) return "Invalid: Total Equity / Net Worth is zero";
        return "Missing required financial inputs";
      }
      case "payablesDays": {
        const tradePayables = yearFields?.tradePayables?.value ?? null;
        const costOfSales = yearFields?.costOfSales?.value ?? null;
        if (tradePayables == null) return "Missing: Trade Payables";
        if (costOfSales == null) return "Missing: Cost of Sales";
        if (costOfSales === 0) return "Invalid: Cost of Sales is zero";
        return "Missing required financial inputs";
      }
      case "return_of_equity": {
        const pat = resolvedByYear.get(year)?.fields.plnpat?.value ?? null;
        const yearFields = resolvedByYear.get(year)?.fields;
        const netWorthValFromFields = yearFields?.networth?.value ?? null;
        const netWorthVal =
          netWorthValFromFields ??
          resolveNetWorthFromComponentsForRoe({
            fixedAssets: yearFields?.bsfatot?.value ?? null,
            otherAssets: yearFields?.othass?.value ?? null,
            currentAssets: yearFields?.bscatot?.value ?? null,
            nonCurrentAssets: yearFields?.bsclbank?.value ?? null,
            currentLiabilities: yearFields?.curlib?.value ?? null,
            longTermLiabilities: yearFields?.bsslltd?.value ?? null,
            nonCurrentLiabilities: yearFields?.bsclstd?.value ?? null,
          });
        return getReturnOfEquityMissingReason({ pat, netWorth: netWorthVal });
      }
      default:
        return null;
    }
  };

  const isMutedFinancialCell = (text: string) =>
    text === "—" ||
    text === CANNOT_CALCULATE_LABEL ||
    text === "Missing in CTOS extract" ||
    text === "Field empty in CTOS" ||
    false;

  return (
    <>
      <ReviewFieldBlock
        title="Financial Summary"
        titleTooltip="Past financial years come from the organization CTOS report. Issuer columns are unaudited figures entered on the application. An open year is year-to-date as at today."
      >
        <div className={applicationTableWrapperClass}>
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full min-w-[960px] text-[15px]">
              <TableHeader className={cn(applicationTableHeaderBgClass, "[&_tr]:border-b-border")}>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead
                    className={cn(
                      applicationTableHeaderClass,
                      "w-[22%] min-w-[140px] border-r border-border bg-muted/30 align-middle"
                    )}
                  >
                    Year
                  </TableHead>
                  {columns.map((spec, i) => (
                    <TableHead
                      key={`yr-${i}-${spec.kind}-${spec.year ?? "dash"}`}
                      className={cn(
                        applicationTableHeaderClass,
                        "w-[15.5%] min-w-[8.5rem] align-middle text-center tabular-nums",
                        i < issuerDetailColumnIndices.length - 1 ? "border-r border-border" : "",
                        financialSummaryColumnShellClass(spec.kind, i, spec.year)
                      )}
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5 min-h-[3.25rem]">
                        <span className="text-foreground text-[14px] font-normal leading-snug">
                          {spec.year != null
                            ? `FY${spec.year}`
                            : spec.kind === "ctos"
                              ? "No year"
                              : HEADER_PLACEHOLDER}
                        </span>

                        {spec.kind === "unaudited" && spec.year != null ? (
                          <AdminUnauditedYearHeading year={spec.year} questionnaire={financialQuestionnaire} />
                        ) : null}

                        {spec.kind === "admin_fallback_placeholder" && spec.year != null ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-1.5 py-0 whitespace-nowrap hover:underline"
                            title="Add financial statement"
                            onClick={() => {
                              setAddFinancialStatementYear(spec.year);
                              setAddFinancialStatementOpen(true);
                            }}
                          >
                            <span className="flex items-center gap-1">
                              <PlusIcon className="h-4 w-4" aria-hidden />
                              <span className="whitespace-nowrap text-[13px] font-normal">Add statement</span>
                            </span>
                          </Button>
                        ) : spec.kind !== "admin_fallback_placeholder" && spec.year != null ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-1.5 py-0 whitespace-nowrap hover:underline"
                            title="Edit financial statement"
                            onClick={() => {
                              setEditFinancialStatementYear(spec.year as number);
                              setEditFinancialStatementOpen(true);
                            }}
                          >
                            <span className="flex items-center gap-1">
                              <PencilSquareIcon className="h-4 w-4" aria-hidden />
                              <span className="whitespace-nowrap text-[13px] font-normal">Edit statement</span>
                            </span>
                          </Button>
                        ) : null}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead
                    className={cn(applicationTableHeaderClass, "border-r border-border bg-muted/30 align-middle")}
                  >
                    Source
                  </TableHead>
                  {columns.map((spec, i) => (
                    <TableHead
                      key={`typ-${i}-${spec.kind}`}
                      className={cn(
                        applicationTableHeaderClass,
                        "align-middle text-right tabular-nums",
                        i < columns.length - 1 ? "border-r border-border" : "",
                        financialSummaryColumnShellClass(spec.kind, i, spec.year),
                        spec.kind === "unaudited" && "font-semibold text-foreground"
                      )}
                    >
                      <div className="flex justify-end">
                        {spec.kind === "ctos" && spec.year != null ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 whitespace-nowrap font-normal text-[11px] leading-tight px-2.5 py-0.5 rounded-md shadow-none",
                              "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                            )}
                          >
                            CTOS
                          </Badge>
                        ) : spec.kind === "unaudited" && spec.year != null ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 whitespace-nowrap font-normal text-[11px] leading-tight px-2.5 py-0.5 rounded-md shadow-none",
                              "border-border bg-muted/50 text-foreground"
                            )}
                          >
                            User Input
                          </Badge>
                        ) : spec.kind === "admin_input" && spec.year != null ? (
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 whitespace-nowrap font-normal text-[11px] leading-tight px-2.5 py-0.5 rounded-md shadow-none",
                                "border-border bg-muted/50 text-foreground"
                              )}
                            >
                              Admin Input
                            </Badge>
                          </div>
                        ) : null}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {flattenedRows.map((item) => {
                  if (item.kind === "category") {
                    return (
                      <TableRow key={`cat-${item.categoryId}`} className={applicationTableRowClass}>
                        <TableCell
                          colSpan={1 + columns.length}
                          className={cn(
                            "border-r-0 bg-muted/25 text-foreground py-2",
                            "border-t border-border border-b border-border/70"
                          )}
                        >
                          <div className="flex items-center gap-3 pl-4">
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 font-semibold text-foreground"
                              aria-expanded={openCategories[item.categoryId]}
                              onClick={() =>
                                setOpenCategories((prev) => ({
                                  ...prev,
                                  [item.categoryId]: !prev[item.categoryId],
                                }))
                              }
                            >
                              {openCategories[item.categoryId] ? (
                                <ChevronDownIcon className="h-4 w-4" aria-hidden />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4" aria-hidden />
                              )}
                              <span className="text-sm">{item.title}</span>
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const rowMeta = getRowMeta(item.rowId);
                  const rowLabel = rowMeta.label;
                  const rowFormulaHint = rowMeta.formulaHint;

                  return (
                    <TableRow key={item.rowId} className={applicationTableRowClass}>
                      <TableCell
                        className={cn(
                          applicationTableCellClass,
                          "border-r border-border bg-muted/20 font-semibold text-foreground"
                        )}
                      >
                        <div className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                          <span>{rowLabel}</span>
                          {rowFormulaHint ? (
                            <span className="max-w-[min(18rem,100%)] text-[11px] font-normal leading-snug text-muted-foreground">
                              {rowFormulaHint}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      {columns.map((spec, ci) => {
                        const cellText = renderRowCell(item.rowId, ci);
                        const muted = isMutedFinancialCell(cellText);
                        const resolvedField =
                          spec.year != null && isAdminEditableRawFinancialKey(item.rowId)
                            ? resolvedByYear.get(spec.year)?.fields[item.rowId]
                            : undefined;

                        const uiCalculated = isCalculatedFinancialMetricKey(item.rowId) || item.rowId === "debtEquityPercent";
                        const canEditField =
                          canManageFinancialCtos &&
                          spec.kind !== "admin_fallback_placeholder" &&
                          spec.kind !== "empty" &&
                          resolvedField != null &&
                          !resolvedField.readOnly &&
                          !uiCalculated;

                        const yearPrimarySource =
                          spec.year != null ? resolvedByYear.get(spec.year)?.primarySource : undefined;

                        const sourceBadge =
                          uiCalculated
                            ? null
                            : resolvedField && resolvedField.value != null && yearPrimarySource
                              ? // Only show a badge when the field source is an exception to the column’s primary source.
                                resolvedField.editedByAdmin ||
                                  resolvedField.source !== yearPrimarySource
                                ? financialFieldSourceBadge(resolvedField)
                                : null
                              : null;

                        const ctosMissingTooltip =
                          resolvedField?.unavailableReason === "not_provided_by_ctos" && resolvedField.value == null
                            ? "Not provided by CTOS"
                            : undefined;

                        const calculatedHelperText = !uiCalculated
                          ? null
                          : getCalculatedHelperText(item.rowId, ci);

                        return (
                          <TableCell
                            key={`${spec.kind}-${spec.year ?? "x"}-${ci}`}
                            className={cn(
                              applicationTableCellClass,
                              "group border-r border-border text-right tabular-nums last:border-r-0",
                              financialSummaryColumnShellClass(spec.kind, ci, spec.year),
                              !muted && "text-foreground"
                            )}
                          >
                            <div className="flex flex-col items-end gap-1">
                              {muted ? (
                                cellText === "—" ? (
                                  <span className="text-muted-foreground" title={ctosMissingTooltip}>
                                    {cellText}
                                  </span>
                                ) : cellText === CANNOT_CALCULATE_LABEL ? (
                                  <span
                                    className="text-amber-800 dark:text-amber-300"
                                    title={ctosMissingTooltip}
                                  >
                                    {cellText}
                                  </span>
                                ) : (
                                  <span
                                    className="inline-block max-w-full rounded-md border border-dashed border-border/70 bg-muted/25 px-2 py-0.5 text-xs leading-snug text-muted-foreground"
                                    title={ctosMissingTooltip}
                                  >
                                    {cellText}
                                  </span>
                                )
                              ) : (
                                <span className="tabular-nums" title={ctosMissingTooltip}>
                                  {cellText}
                                </span>
                              )}

                              {sourceBadge ? (
                                <span className="text-[11px] font-normal leading-tight text-muted-foreground">
                                  {sourceBadge}
                                </span>
                              ) : null}

                              {cellText === CANNOT_CALCULATE_LABEL && calculatedHelperText ? (
                                <span className="text-[11px] font-normal leading-snug text-amber-700 dark:text-amber-400">
                                  {calculatedHelperText}
                                </span>
                              ) : null}

                              {canEditField && spec.year != null ? (
                                <button
                                  type="button"
                                  className="opacity-0 group-hover:opacity-100 text-meta text-primary hover:underline"
                                  onClick={() =>
                                    setFieldEdit({
                                      year: spec.year as number,
                                      key: item.rowId,
                                      label: rowLabel,
                                      value: resolvedField?.value ?? null,
                                    })
                                  }
                                  title={resolvedField?.value == null ? "Add financial value" : "Edit financial value"}
                                  aria-label={resolvedField?.value == null ? "Add financial value" : "Edit financial value"}
                                >
                                  <PencilSquareIcon className="h-4 w-4" aria-hidden />
                                </button>
                              ) : null}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </ReviewFieldBlock>


      <ReviewFieldBlock
        title="Director and Shareholders"
        titleTooltip="The director and shareholder list comes from the organization CTOS report. Fetch again to get the latest list."
      >
        {hasPendingDirectorShareholder ? (
          <div className="space-y-1.5 rounded-xl border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-ui text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="whitespace-pre-line">
              {formatDirectorShareholderReviewHint(app.people)}
            </p>
            {issuerOrgId && canViewOrganizations ? (
              <Link
                href={orgPeopleAccessHref("issuer", issuerOrgId, {
                  filter: "pending",
                })}
                className="inline-flex text-primary underline-offset-4 hover:underline"
              >
                Review and sync in People &amp; Access
              </Link>
            ) : null}
          </div>
        ) : null}
        <DirectorShareholderTable
          people={app.people ?? []}
          directorShareholderListSource={app.directorShareholderListSource ?? null}
          ctosDirectorShareholderWarning={app.ctosDirectorShareholderWarning ?? null}
          portal="issuer"
          organizationId={issuerOrgId}
          subjectCtosReports={app.issuer_organization?.latest_organization_ctos_subject_reports ?? null}
          ctosFetchPending={createSubjectReport.isPending}
          ctosFetchPendingKey={subjectCtosFetchKey}
          canManageCtos={canManageFinancialCtos}
          ctosViewReportApplicationId={applicationId}
          onFetchSubjectCtos={(person) => {
            const idKey = normalizeDirectorShareholderIdKey(person.matchKey);
            if (!idKey) {
              toast.error("Missing IC / SSM. Cannot fetch CTOS report.");
              return;
            }
            const displayName = person.name?.trim();
            if (!displayName) {
              toast.error("Missing name. Cannot fetch CTOS report.");
              return;
            }
            setSubjectCtosFetchKey(idKey);
            createSubjectReport.mutate(
              {
                subjectRef: idKey,
                subjectKind: person.entityType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL",
                enquiryOverride: { displayName, idNumber: idKey },
              },
              {
                onSettled: () => setSubjectCtosFetchKey(null),
                onSuccess: () => toast.success("Subject report updated"),
                onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Request failed"),
              }
            );
          }}
        />
      </ReviewFieldBlock>

      <ReviewFieldBlock title="MARC Credit Assessment">
        {(() => {
          const marc = app.issuer_organization?.marcAssessment ?? null;
          const grade = isMarcSmeGrade(marc?.creditGrade) ? marc.creditGrade : null;
          if (!marc || !isCompleteIssuerMarcAssessment(marc) || !grade) {
            return (
              <div className="space-y-3">
                <p className={reviewEmptyStateClass}>{MARC_ASSESSMENT_REQUIRED_MESSAGE}</p>
                <p className={reviewEmptyStateClass}>
                  Complete the issuer MARC assessment before approving Financial. Invoice offers
                  default to this grade.
                </p>
                {issuerOrgId ? (
                  <Button asChild variant="outline" size="sm" className="rounded-lg">
                    <Link href={orgHref("issuer", issuerOrgId)}>Open issuer MARC assessment</Link>
                  </Button>
                ) : null}
              </div>
            );
          }
          const score =
            marc.creditScore != null ? String(marc.creditScore) : REVIEW_EMPTY_LABEL;
          const pd =
            marc.probabilityOfDefault != null
              ? `${marc.probabilityOfDefault}%`
              : REVIEW_EMPTY_LABEL;
          const reportDate = marc.reportDate
            ? format(new Date(marc.reportDate), "dd MMM yyyy")
            : REVIEW_EMPTY_LABEL;
          const lastUpdated = marc.assessedAt
            ? format(new Date(marc.assessedAt), "dd MMM yyyy")
            : REVIEW_EMPTY_LABEL;
          return (
            <div className="space-y-3">
              <div className={reviewRowGridClass}>
                <span className={reviewLabelClass}>Credit Grade</span>
                <span className={reviewValueClass}>{grade}</span>
                <span className={reviewLabelClass}>Risk Profile</span>
                <span className={reviewValueClass}>
                  {marcOfficialRiskProfile(grade) ?? REVIEW_EMPTY_LABEL}
                </span>
                <span className={reviewLabelClass}>Credit Score</span>
                <span className={reviewValueClass}>{score}</span>
                <span className={reviewLabelClass}>Probability of Default</span>
                <span className={reviewValueClass}>{pd}</span>
                <span className={reviewLabelClass}>Report</span>
                <span className={reviewValueClass}>
                  {marc.reportFileName?.trim() || REVIEW_EMPTY_LABEL}
                </span>
                <span className={reviewLabelClass}>Report date</span>
                <span className={reviewValueClass}>{reportDate}</span>
                <span className={reviewLabelClass}>Last updated</span>
                <span className={reviewValueClass}>{lastUpdated}</span>
              </div>
              {issuerOrgId ? (
                <Button asChild variant="outline" size="sm" className="rounded-lg">
                  <Link href={orgHref("issuer", issuerOrgId)}>Open issuer MARC assessment</Link>
                </Button>
              ) : null}
            </div>
          );
        })()}
      </ReviewFieldBlock>

      <AdminAddFinancialStatementDialog
        open={addFinancialStatementOpen}
        onOpenChange={setAddFinancialStatementOpen}
        applicationId={applicationId}
        calendarYear={addFinancialStatementYear}
        disabled={!canManageFinancialCtos || addFinancialStatementYear == null}
        onSaved={onAddFinancialStatementSaved}
      />
      <AdminEditFinancialStatementDialog
        open={editFinancialStatementOpen}
        onOpenChange={(open) => {
          if (!open) setEditFinancialStatementYear(null);
          setEditFinancialStatementOpen(open);
        }}
        applicationId={applicationId}
        calendarYear={editFinancialStatementYear}
        resolvedColumn={
          editFinancialStatementYear != null ? resolvedByYear.get(editFinancialStatementYear) ?? null : null
        }
        disabled={!canManageFinancialCtos}
        onSaved={onEditFinancialStatementSaved}
      />
      <AdminEditFinancialFieldDialog
        open={fieldEdit != null}
        onOpenChange={(open) => {
          if (!open) setFieldEdit(null);
        }}
        applicationId={applicationId}
        calendarYear={fieldEdit?.year ?? null}
        fieldKey={fieldEdit?.key ?? null}
        fieldLabel={fieldEdit?.label ?? "Field"}
        initialValue={fieldEdit?.value ?? null}
        disabled={!canManageFinancialCtos}
        onSaved={onAddFinancialStatementSaved}
      />

    </>
  );
}
