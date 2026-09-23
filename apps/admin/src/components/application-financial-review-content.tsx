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
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import {
  FINANCIAL_FIELD_LABELS,
  computeColumnMetrics,
  computeReceivablesDays,
  computeTurnoverGrowth,
  financialFormToBsPl,
  computeHasPendingDirectorShareholder,
  normalizeDirectorShareholderIdKey,
  resolveCtosCurrentRatio,
  resolveCtosPatMarginPercent,
  resolveCtosReturnOnEquityPercent,
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

export { extractQuestionnaireAndUnaudited } from "@/lib/stored-unaudited-years";

/** Year row placeholder when no year (em dash). */
const HEADER_PLACEHOLDER = "\u2014";

function AdminUnauditedYearHeading({
  year,
  questionnaire,
}: {
  year: number;
  questionnaire: Parameters<typeof adminUnauditedYearPresentation>[0];
}) {
  const lines = adminFyPeriodLines(adminUnauditedYearPresentation(questionnaire, year).periodLine);
  return (
    <span className="flex flex-col items-end gap-0.5 text-right">
      <span>{`FY${year}`}</span>
      {lines.length > 0 ? (
        <span className="text-meta font-normal leading-snug text-muted-foreground">
          {lines.map((line) => (
            <span key={line} className="block whitespace-nowrap">
              {line}
            </span>
          ))}
        </span>
      ) : null}
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
    kind === "ctos" ? "bg-muted/25" : "bg-background/80",
    isFirstUnaudited && "border-l-2 border-l-border",
    emptySlot && "bg-muted/30 opacity-70",
    extra
  );
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
  }, [applicationId, queryClient]);

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
    const spec = columns[colIdx];
    if (ctosColumnMissing(colIdx)) {
      return spec?.kind === "ctos" ? "Missing in CTOS extract" : "Not provided in issuer form";
    }
    if (valueMissing) {
      return spec?.kind === "ctos" ? "Not provided by CTOS" : "Not provided";
    }
    return fmt();
  };

  /** Short hint under label for computed rows (admin scan speed). */
  const rowLabels: { id: string; label: string; formulaHint?: string }[] = [
    { id: "pldd", label: "Financial Year End" },
    { id: "bsfatot", label: FINANCIAL_FIELD_LABELS.bsfatot },
    { id: "othass", label: FINANCIAL_FIELD_LABELS.othass },
    { id: "bscatot", label: FINANCIAL_FIELD_LABELS.bscatot },
    { id: "bsclbank", label: FINANCIAL_FIELD_LABELS.bsclbank },
    {
      id: "totass",
      label: COMPUTED_FIELD_LABELS.totass,
      formulaHint: "Calculated as Total Assets from issuer financial information when a total isn't provided.",
    },
    { id: "curlib", label: FINANCIAL_FIELD_LABELS.curlib },
    { id: "bsslltd", label: FINANCIAL_FIELD_LABELS.bsslltd },
    { id: "bsclstd", label: FINANCIAL_FIELD_LABELS.bsclstd },
    {
      id: "totlib",
      label: COMPUTED_FIELD_LABELS.totlib,
      formulaHint:
        "Calculated as Total Liabilities from issuer financial information when a total isn't provided.",
    },
    { id: "networth", label: COMPUTED_FIELD_LABELS.networth, formulaHint: "Total Assets − Total Liabilities" },
    { id: "bsqpuc", label: "Paid-up Share Capital" },
    { id: "turnover", label: "Revenue (Turnover)" },
    { id: "plnpbt", label: FINANCIAL_FIELD_LABELS.plnpbt },
    { id: "plnpat", label: FINANCIAL_FIELD_LABELS.plnpat },
    { id: "plnetdiv", label: FINANCIAL_FIELD_LABELS.plnetdiv },
    { id: "plyear", label: FINANCIAL_FIELD_LABELS.plyear },
    {
      id: "turnover_growth",
      label: COMPUTED_FIELD_LABELS.turnover_growth,
      formulaHint: "Change in revenue compared with the previous financial year",
    },
    {
      id: "profit_margin",
      label: COMPUTED_FIELD_LABELS.profit_margin,
      formulaHint: "Profit After Tax ÷ Revenue",
    },
    {
      id: "return_of_equity",
      label: COMPUTED_FIELD_LABELS.return_of_equity,
      formulaHint: "Profit After Tax ÷ Net Worth",
    },
    {
      id: "currat",
      label: COMPUTED_FIELD_LABELS.currat,
      formulaHint: "Current Assets ÷ Current Liabilities",
    },
    {
      id: "workcap",
      label: COMPUTED_FIELD_LABELS.workcap,
      formulaHint: "Current Assets − Current Liabilities",
    },
    { id: "cashAndBank", label: FINANCIAL_FIELD_LABELS.cashAndBank },
    { id: "tradeReceivables", label: FINANCIAL_FIELD_LABELS.tradeReceivables },
    { id: "tradePayables", label: FINANCIAL_FIELD_LABELS.tradePayables },
    { id: "grossProfit", label: FINANCIAL_FIELD_LABELS.grossProfit },
    { id: "ebitda", label: FINANCIAL_FIELD_LABELS.ebitda },
    { id: "costOfSales", label: FINANCIAL_FIELD_LABELS.costOfSales },
    { id: "interest_cost", label: FINANCIAL_FIELD_LABELS.interest_cost },
    { id: "operatingCashFlow", label: FINANCIAL_FIELD_LABELS.operatingCashFlow },
    { id: "freeCashFlow", label: FINANCIAL_FIELD_LABELS.freeCashFlow },
    { id: "annualDebtService", label: FINANCIAL_FIELD_LABELS.annualDebtService },
    { id: "netOperatingIncome", label: FINANCIAL_FIELD_LABELS.netOperatingIncome },
    { id: "curlib_borrowing", label: FINANCIAL_FIELD_LABELS.curlib_borrowing },
    { id: "curlib_non_borrowing", label: FINANCIAL_FIELD_LABELS.curlib_non_borrowing },
    { id: "ncl_loan", label: FINANCIAL_FIELD_LABELS.ncl_loan },
    { id: "ncl_non_loan", label: FINANCIAL_FIELD_LABELS.ncl_non_loan },
    { id: "equity_share_application", label: FINANCIAL_FIELD_LABELS.equity_share_application },
    { id: "equity_share_premium", label: FINANCIAL_FIELD_LABELS.equity_share_premium },
    { id: "equity_accumulated_profit", label: FINANCIAL_FIELD_LABELS.equity_accumulated_profit },
    { id: "equity_minority", label: FINANCIAL_FIELD_LABELS.equity_minority },
    { id: "operating_cost", label: FINANCIAL_FIELD_LABELS.operating_cost },
    { id: "admin_cost", label: FINANCIAL_FIELD_LABELS.admin_cost },
    { id: "other_cost", label: FINANCIAL_FIELD_LABELS.other_cost },
    { id: "pl_minority", label: FINANCIAL_FIELD_LABELS.pl_minority },
    {
      id: "receivablesDays",
      label: "Receivables Days",
      formulaHint: "Average Trade Receivables ÷ Revenue × 365",
    },
  ];

  const rowById = new Map(rowLabels.map((r) => [r.id, r] as const));
  const rowGroups: Array<{ title: string; ids: string[] }> = [
    {
      title: "Assets",
      ids: ["bsfatot", "othass", "bscatot", "bsclbank", "cashAndBank", "tradeReceivables", "totass"],
    },
    {
      title: "Liabilities",
      ids: ["curlib", "bsslltd", "bsclstd", "curlib_borrowing", "curlib_non_borrowing", "ncl_loan", "ncl_non_loan", "tradePayables", "totlib"],
    },
    {
      title: "Equity",
      ids: [
        "bsqpuc",
        "equity_share_application",
        "equity_share_premium",
        "equity_accumulated_profit",
        "equity_minority",
        "networth",
      ],
    },
    {
      title: "Profit & Loss",
      ids: ["turnover", "grossProfit", "ebitda", "plnpbt", "plnpat", "plnetdiv", "pl_minority", "plyear", "netOperatingIncome"],
    },
    {
      title: "Costs",
      ids: ["costOfSales", "operating_cost", "admin_cost", "interest_cost", "other_cost"],
    },
    {
      title: "Cash Flow / Debt",
      ids: ["operatingCashFlow", "freeCashFlow", "annualDebtService"],
    },
    {
      title: "Calculated Metrics",
      ids: ["turnover_growth", "profit_margin", "return_of_equity", "currat", "workcap", "receivablesDays"],
    },
  ];

  const renderRowCell = (rowId: string, colIdx: number): string => {
    const specCol = columns[colIdx];
    if (!specCol) return "—";
    if (specCol.kind === "ctos") {
      if (ctosFetchState === "not_pulled" || ctosFetchState === "no_records") return "—";
    }
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
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (specCol.kind === "ctos") {
          const n = resolveCtosTotalAssets({
            totass: fs && ctosFlatNumericPresent(fs, "totass") ? toNum(fs.totass) : null,
          });
          if (n == null) return "N/A";
          return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
        }
        if (!computed) return "N/A";
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
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (specCol.kind === "ctos") {
          const n = resolveCtosTotalLiabilities({
            totlib: fs && ctosFlatNumericPresent(fs, "totlib") ? toNum(fs.totlib) : null,
          });
          if (n == null) return "N/A";
          return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
        }
        if (!computed) return "N/A";
        const n = computed.totlib;
        return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
      }
      case "networth": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (specCol.kind === "ctos") {
          if (!fs || !ctosFlatNumericPresent(fs, "networth")) return "N/A";
          const raw = toNum(fs.networth);
          return raw === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(raw, { decimals: 0 });
        }
        if (!computed) return "N/A";
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
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (specCol.kind === "ctos") {
          if (fs && ctosFlatNumericPresent(fs, "turnover_growth")) {
            return formatNumber(toNum(fs.turnover_growth), 2) + "%";
          }

          const targetTurnover = specCol.year != null ? turnoverByYear.get(specCol.year) ?? null : null;
          const priorTurnover =
            specCol.year != null ? turnoverByYear.get(specCol.year - 1) ?? null : null;
          if (targetTurnover == null) return "Unable to calculate — Revenue unavailable";
          if (priorTurnover == null) return "Unable to calculate — previous FY revenue unavailable";
          const g = computeTurnoverGrowth({
            targetYear: specCol.year,
            targetTurnover,
            priorYear: specCol.year - 1,
            priorTurnover,
          });
          if (g == null) return "Unable to calculate";
          return formatNumber(g * 100, 2) + "%";
        }
        if (!computed || computed.turnover_growth == null) {
          const targetTurnover = specCol.year != null ? turnoverByYear.get(specCol.year) ?? null : null;
          const priorTurnover =
            specCol.year != null ? turnoverByYear.get(specCol.year - 1) ?? null : null;
          if (priorTurnover == null) return "Unable to calculate — previous FY revenue unavailable";
          if (targetTurnover == null) return "Unable to calculate — Revenue unavailable";
          return "Unable to calculate";
        }
        return formatNumber(computed.turnover_growth * 100, 2) + "%";
      }
      case "profit_margin": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        // CTOS: official PAT Margin XSL. Never CTOS profit_margin (PBT Margin).
        if (specCol.kind === "ctos") {
          const row = byYear.get(specCol.year);
          const percent = resolveCtosPatMarginPercent({
            plnpat: row?.account.plnpat ?? null,
            turnover: row?.account.turnover ?? null,
          });
          if (percent == null) return "N/A";
          return formatNumber(percent, 2) + "%";
        }
        if (!computed || computed.profit_margin == null) return "N/A";
        return formatNumber(computed.profit_margin * 100, 2) + "%";
      }
      case "return_of_equity": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (specCol.kind === "ctos") {
          const percent = resolveCtosReturnOnEquityPercent({
            return_on_equity:
              fs && ctosFlatNumericPresent(fs, "return_on_equity")
                ? toNum(fs.return_on_equity)
                : null,
          });
          if (percent == null) return "N/A";
          return formatNumber(percent, 2) + "%";
        }
        if (!computed || computed.return_of_equity == null) return "N/A";
        return formatNumber(computed.return_of_equity * 100, 2) + "%";
      }
      case "currat": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (specCol.kind === "ctos") {
          const n = resolveCtosCurrentRatio({
            currat: fs && ctosFlatNumericPresent(fs, "currat") ? toNum(fs.currat) : null,
          });
          if (n == null) return "N/A";
          return formatNumber(n, 2);
        }
        if (!computed || computed.currat == null) return "N/A";
        return formatNumber(computed.currat, 2);
      }
      case "workcap": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (specCol.kind === "ctos") {
          if (!fs || !ctosFlatNumericPresent(fs, "workcap")) return "N/A";
          return formatCurrency(toNum(fs.workcap), { decimals: 0 });
        }
        if (!computed) return "N/A";
        return formatCurrency(computed.workcap, { decimals: 0 });
      }
      case "receivablesDays": {
        if (specCol.year == null || specCol.kind === "admin_fallback_placeholder") return "—";
        const ending = resolvedByYear.get(specCol.year)?.fields.tradeReceivables?.value ?? null;
        const prior = resolvedByYear.get(specCol.year - 1)?.fields.tradeReceivables?.value ?? null;
        const turnover = resolvedByYear.get(specCol.year)?.fields.turnover?.value ?? null;
        const reason = receivablesDaysUnavailableReason({
          year: specCol.year,
          endingTradeReceivables: ending,
          priorTradeReceivables: prior,
          turnover,
        });
        if (reason) return reason;
        const days = computeReceivablesDays(prior, ending, turnover);
        return days == null ? "Unable to calculate" : formatNumber(days, 2);
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

  const isMutedFinancialCell = (text: string) =>
    text === "—" ||
    text === "N/A" ||
    text === "Missing in CTOS extract" ||
    text === "Not provided by CTOS" ||
    text === "Not provided" ||
    text === "Field empty in CTOS" ||
    text === "Not provided in issuer form" ||
    text.startsWith("Unable to calculate");

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
                        "w-[15.5%] min-w-[8.5rem] align-middle text-right tabular-nums",
                        i < issuerDetailColumnIndices.length - 1 ? "border-r border-border" : "",
                        financialSummaryColumnShellClass(spec.kind, i, spec.year)
                      )}
                    >
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={spec.year != null ? "text-foreground" : "text-muted-foreground"}>
                          {spec.kind === "admin_fallback_placeholder" && spec.year != null ? (
                            <button
                              type="button"
                              className="inline-flex flex-col items-end gap-0.5 text-right hover:underline cursor-pointer"
                              onClick={() => {
                                setAddFinancialStatementYear(spec.year);
                                setAddFinancialStatementOpen(true);
                              }}
                            >
                              <span>{`FY${spec.year}`}</span>
                              <span className="text-meta font-normal leading-snug text-primary">
                                + Add Financial Statement
                              </span>
                            </button>
                          ) : spec.kind === "unaudited" && spec.year != null ? (
                            <AdminUnauditedYearHeading
                              year={spec.year}
                              questionnaire={financialQuestionnaire}
                            />
                          ) : spec.kind === "admin_input" && spec.year != null ? (
                            <span>{`FY${spec.year}`}</span>
                          ) : spec.year != null ? (
                            String(spec.year)
                          ) : spec.kind === "ctos" ? (
                            "No year"
                          ) : (
                            HEADER_PLACEHOLDER
                          )}
                        </span>
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
                        ) : null}
                        {spec.kind === "unaudited" && spec.year != null ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 whitespace-nowrap font-normal text-[11px] leading-tight px-2.5 py-0.5 rounded-md shadow-none",
                              "border-border bg-muted/50 text-foreground"
                            )}
                          >
                            User Input
                          </Badge>
                        ) : null}
                        {spec.kind === "admin_input" && spec.year != null ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 whitespace-nowrap font-normal text-[11px] leading-tight px-2.5 py-0.5 rounded-md shadow-none",
                              "border-border bg-muted/50 text-foreground"
                            )}
                          >
                            Admin Input
                          </Badge>
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
                            {spec.statementType ? (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "shrink-0 whitespace-nowrap font-normal text-[11px] leading-tight px-2.5 py-0.5 rounded-md shadow-none bg-muted/70"
                                )}
                              >
                                {spec.statementType === "AUDITED"
                                  ? "Audited"
                                  : spec.statementType === "NOT_AUDITED"
                                    ? "Not audited"
                                    : spec.statementType === "MANAGEMENT_ACCOUNTS"
                                      ? "Management accounts"
                                      : spec.statementType}
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowLabels.map((row) => (
                  <TableRow key={row.id} className={applicationTableRowClass}>
                    <TableCell
                      className={cn(
                        applicationTableCellClass,
                        "border-r border-border bg-muted/20 font-medium text-foreground"
                      )}
                    >
                      <div className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                        <span>{row.label}</span>
                        {row.formulaHint ? (
                          <span className="max-w-[min(18rem,100%)] text-[11px] font-normal leading-snug text-muted-foreground">
                            {row.formulaHint}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    {columns.map((spec, ci) => {
                      const cellText = renderRowCell(row.id, ci);
                      const muted = isMutedFinancialCell(cellText);
                      const resolvedField =
                        spec.year != null && isAdminEditableRawFinancialKey(row.id)
                          ? resolvedByYear.get(spec.year)?.fields[row.id]
                          : undefined;
                      const calculated = isCalculatedFinancialMetricKey(row.id);
                      const canEditField =
                        canManageFinancialCtos &&
                        spec.kind !== "admin_fallback_placeholder" &&
                        spec.kind !== "empty" &&
                        resolvedField != null &&
                        !resolvedField.readOnly;
                      const yearPrimarySource = spec.year != null ? resolvedByYear.get(spec.year)?.primarySource : undefined;
                      const sourceBadge =
                        calculated
                          ? null
                          : resolvedField && resolvedField.value != null && yearPrimarySource
                            ? // Only show a badge when the field source is an exception to the column’s primary source.
                              resolvedField.editedByAdmin ||
                                resolvedField.source !== yearPrimarySource
                              ? financialFieldSourceBadge(resolvedField)
                              : null
                            : null;
                      return (
                        <TableCell
                          key={`${spec.kind}-${spec.year ?? "x"}-${ci}`}
                          className={cn(
                            applicationTableCellClass,
                            "border-r border-border text-right tabular-nums last:border-r-0",
                            financialSummaryColumnShellClass(spec.kind, ci, spec.year),
                            !muted && "text-foreground"
                          )}
                        >
                          <div className="flex flex-col items-end gap-1">
                            {muted ? (
                              cellText === "—" || cellText === "N/A" ? (
                                <span className="text-muted-foreground">{cellText}</span>
                              ) : (
                                <span className="inline-block max-w-full rounded-md border border-dashed border-border/70 bg-muted/25 px-2 py-0.5 text-xs leading-snug text-muted-foreground">
                                  {cellText}
                                </span>
                              )
                            ) : (
                              <span className="tabular-nums">{cellText}</span>
                            )}
                            {sourceBadge ? (
                              <span className="text-[11px] font-normal leading-tight text-muted-foreground">
                                {sourceBadge}
                              </span>
                            ) : null}
                            {resolvedField?.unavailableReason === "not_provided_by_ctos" &&
                            resolvedField.value == null ? (
                              <span className="text-[11px] font-normal leading-tight text-muted-foreground">
                                Not provided by CTOS
                              </span>
                            ) : null}
                            {canEditField && spec.year != null ? (
                              <button
                                type="button"
                                className="text-meta text-primary hover:underline"
                                onClick={() =>
                                  setFieldEdit({
                                    year: spec.year as number,
                                    key: row.id,
                                    label: row.label,
                                    value: resolvedField?.value ?? null,
                                  })
                                }
                                title={resolvedField?.value == null ? "Add financial value" : "Edit financial value"}
                                aria-label={resolvedField?.value == null ? "Add financial value" : "Edit financial value"}
                              >
                                {resolvedField?.value == null ? (
                                  "+ Add"
                                ) : (
                                  <PencilSquareIcon className="h-4 w-4" aria-hidden />
                                )}
                              </button>
                            ) : null}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
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
