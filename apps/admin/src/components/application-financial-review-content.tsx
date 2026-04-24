"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { ReviewFieldBlock } from "@/components/application-review/review-field-block";
import { reviewEmptyStateClass } from "@/components/application-review/review-section-styles";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { formatCurrency, formatNumber, useAuthToken } from "@cashsouk/config";
import {
  FINANCIAL_FIELD_LABELS,
  computeColumnMetrics,
  computeTurnoverGrowth,
  financialFormToBsPl,
  formatFinancialFyPeriodDisplay,
  getAdminFinancialSummaryUserColumnYears,
  getLatestThreeCtosYearSlots,
  getDirectorShareholderDisplayRows,
  type DirectorShareholderDisplayRow,
  normalizeFinancialStatementsQuestionnaire,
  type ColumnComputedMetrics,
  type FinancialStatementsInput,
  type FinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import { toast } from "sonner";
import { format, isValid, parse, parseISO } from "date-fns";
import {
  useAdminApplicationCtosReports,
  useAdminApplicationCtosSubjectReports,
  useCreateAdminApplicationCtosReport,
  useCreateAdminApplicationCtosSubjectReport,
} from "@/hooks/use-admin-application-ctos-reports";
import { CTOS_ACTION_BUTTON_COMPACT_CLASSNAME, CTOS_CONFIRM, CTOS_UI } from "@/lib/ctos-ui-labels";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Year row placeholder when no year (em dash). */
const HEADER_PLACEHOLDER = "\u2014";

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
  kind: "ctos" | "unaudited",
  colIndex: number,
  year: number | null,
  extra?: string
) {
  const isFirstUnaudited = kind === "unaudited" && colIndex === 3;
  const emptyCtosSlot = kind === "ctos" && year == null;
  return cn(
    kind === "ctos" ? "bg-muted/25" : "bg-background/80",
    isFirstUnaudited && "border-l-2 border-l-border",
    emptyCtosSlot && "bg-muted/30 opacity-70",
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

export function extractQuestionnaireAndUnaudited(financialRaw: unknown): {
  questionnaire: FinancialStatementsQuestionnaire | null;
  unauditedByYear: Record<string, Record<string, unknown>>;
} {
  if (!financialRaw || typeof financialRaw !== "object") {
    return { questionnaire: null, unauditedByYear: {} };
  }
  const obj = financialRaw as Record<string, unknown>;
  const qRaw = obj.questionnaire;
  const byYear = obj.unaudited_by_year as Record<string, Record<string, unknown>> | undefined;
  if (
    qRaw &&
    typeof qRaw === "object" &&
    byYear &&
    typeof byYear === "object" &&
    !Array.isArray(byYear)
  ) {
    const questionnaire = normalizeFinancialStatementsQuestionnaire(qRaw);
    return { questionnaire, unauditedByYear: byYear };
  }
  return { questionnaire: null, unauditedByYear: {} };
}

export function firstUnauditedYearFinancialBlock(raw: unknown): Record<string, unknown> {
  const { unauditedByYear } = extractQuestionnaireAndUnaudited(raw);
  const years = Object.keys(unauditedByYear).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  if (years.length === 0) return {};
  const block = unauditedByYear[years[0]];
  return block && typeof block === "object" ? (block as Record<string, unknown>) : {};
}

type ColumnSpec = { kind: "ctos"; year: number | null } | { kind: "unaudited"; year: number | null };

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
 * WHY: Prefer CTOS `account` values; see docs/guides/admin/ctos-financial-summary-display.md for fallback formulas.
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
    turnover: toNum(fs.turnover),
    plnpat: toNum(fs.plnpat),
  };
}

export interface DirectorShareholderRow {
  id: string;
  name: string;
  role: string;
  ownership: string | null;
  /** Government ID (individual) or business registration number (corporate); used only for CTOS cross-check key. */
  icOrSsm: string | null;
  verificationLabel: "KYC" | "KYB";
  verificationStatus: string | null;
  /** RegTank EOD… or COD…; Get/View CTOS subject report when set. */
  subjectRef: string | null;
  subjectKind: "INDIVIDUAL" | "CORPORATE" | null;
}

function normalizeIcSsmKey(raw: string | null | undefined): string | null {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "");
  if (!s) return null;
  return s.toLowerCase();
}

/**
 * SECTION: CTOS subject report map / request key
 * WHY: DB stores canonical IC/SSM (see ctos-report-service); list keys normalized; fallback EOD/COD for legacy rows
 * INPUT: icOrSsm, subjectRef
 * OUTPUT: lookup key or null
 * WHERE USED: subjectReportByRef get, Get report payload
 */
function ctosSubjectReportLookupKey(
  icOrSsm: string | null | undefined,
  subjectRef: string | null | undefined
): string | null {
  const fromIc = normalizeIcSsmKey(icOrSsm);
  if (fromIc) return fromIc;
  const s = String(subjectRef ?? "")
    .trim()
    .replace(/\s+/g, "");
  return s ? s.toLowerCase() : null;
}

function lookupSubjectReportSnap(
  m: Map<string, { id: string; has_report_html: boolean; fetched_at: string }>,
  icOrSsm: string | null | undefined,
  subjectRef: string | null | undefined
): { id: string; has_report_html: boolean; fetched_at: string } | undefined {
  const kIc = normalizeIcSsmKey(icOrSsm);
  if (kIc) {
    const hit = m.get(kIc);
    if (hit) return hit;
  }
  const kRef = String(subjectRef ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
  if (kRef) return m.get(kRef);
  return undefined;
}

/** Value sent as POST subjectRef: prefer government ID / business number; else RegTank EOD/COD (normalized). */
function ctosSubjectRefForRequest(row: DirectorShareholderRow): string | null {
  return ctosSubjectReportLookupKey(row.icOrSsm, row.subjectRef);
}

function displayDirectorRowToSubjectRow(row: DirectorShareholderDisplayRow): DirectorShareholderRow {
  const r = row;
  const idStr = r.idNumber?.trim() || r.registrationNumber?.trim() || "";
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    ownership: null,
    icOrSsm: idStr || null,
    verificationLabel: r.type === "COMPANY" ? "KYB" : "KYC",
    verificationStatus: r.status,
    subjectRef: null,
    subjectKind: r.subjectKind,
  };
}

function formatCtosListFetchedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return null;
  }
}

function subjectLastFetchDisplay(params: {
  subjectRef: string | null;
  snap: { fetched_at: string } | undefined;
}): React.ReactNode {
  if (!params.subjectRef) {
    return <span className="text-muted-foreground">{HEADER_PLACEHOLDER}</span>;
  }
  const formatted = params.snap?.fetched_at ? formatCtosListFetchedAt(params.snap.fetched_at) : null;
  if (formatted) {
    return <span className="tabular-nums text-muted-foreground">{formatted}</span>;
  }
  return <span className="text-muted-foreground">{HEADER_PLACEHOLDER}</span>;
}

interface ApplicationFinancialReviewContentProps {
  applicationId: string;
  app: {
    issuer_organization?: {
      corporate_entities?: unknown;
      director_kyc_status?: unknown;
      director_aml_status?: unknown;
    } | null;
    financial_statements?: unknown;
  };
}

export function ApplicationFinancialReviewContent({ applicationId, app }: ApplicationFinancialReviewContentProps) {
  const { getAccessToken } = useAuthToken();
  const { data: ctosList, isLoading: ctosLoading } = useAdminApplicationCtosReports(applicationId);
  const createCtos = useCreateAdminApplicationCtosReport(applicationId);
  const { data: ctosSubjectList, isLoading: ctosSubjectLoading } = useAdminApplicationCtosSubjectReports(applicationId);
  const createSubjectCtos = useCreateAdminApplicationCtosSubjectReport(applicationId);
  const [orgCtosConfirmOpen, setOrgCtosConfirmOpen] = React.useState(false);
  const [subjectCtosConfirm, setSubjectCtosConfirm] = React.useState<{
    row: DirectorShareholderRow;
    enquiryOverride?: { displayName: string; idNumber: string };
  } | null>(null);

  const subjectReportByRef = React.useMemo(() => {
    const m = new Map<string, { id: string; has_report_html: boolean; fetched_at: string }>();
    for (const r of ctosSubjectList ?? []) {
      const ref = r.subject_ref;
      if (!ref) continue;
      const k = ref.trim().replace(/\s+/g, "").toLowerCase();
      m.set(k, { id: r.id, has_report_html: Boolean(r.has_report_html), fetched_at: r.fetched_at });
    }
    return m;
  }, [ctosSubjectList]);

  const { unauditedByYear, questionnaire: financialQuestionnaire } = React.useMemo(
    () => extractQuestionnaireAndUnaudited(app.financial_statements),
    [app.financial_statements]
  );
  const hasIssuerFinancialData = Object.keys(unauditedByYear).length > 0;

  const latestCtos = ctosList?.[0];

  const directorDisplayRows = React.useMemo(
    () =>
      getDirectorShareholderDisplayRows({
        corporateEntities: app.issuer_organization?.corporate_entities,
        directorKycStatus: app.issuer_organization?.director_kyc_status,
        organizationCtosCompanyJson: latestCtos?.company_json ?? null,
        sentRowIds: null,
      }),
    [app.issuer_organization, latestCtos?.company_json]
  );

  const financialRows: CtosFinRow[] = React.useMemo(() => {
    const raw = latestCtos?.financials_json;
    if (!raw || !Array.isArray(raw)) return [];
    return raw as CtosFinRow[];
  }, [latestCtos]);

  const ctosFetchState = React.useMemo((): CtosFetchState => {
    if (!latestCtos) return "not_pulled";
    if (financialRows.length === 0) return "no_records";
    return "has_data";
  }, [latestCtos, financialRows]);

  const byYear = React.useMemo(() => {
    const m = new Map<number, CtosFinRow>();
    for (const r of financialRows) {
      if (r.financial_year != null) m.set(r.financial_year, r);
    }
    return m;
  }, [financialRows]);

  const ctosFinancialYearsSet = React.useMemo(() => {
    const s = new Set<number>();
    for (const r of financialRows) {
      if (r.financial_year != null && Number.isFinite(r.financial_year)) {
        s.add(r.financial_year);
      }
    }
    return s;
  }, [financialRows]);

  const adminUserYears = React.useMemo(
    () => getAdminFinancialSummaryUserColumnYears(financialQuestionnaire, new Date()),
    [financialQuestionnaire]
  );

  const columns = React.useMemo((): ColumnSpec[] => {
    const ctosSlotYears = getLatestThreeCtosYearSlots(financialRows);
    const ctosPart: ColumnSpec[] = ctosSlotYears.map((year) => ({
      kind: "ctos" as const,
      year,
    }));

    const unPart: ColumnSpec[] = adminUserYears.map((year) => ({
      kind: "unaudited" as const,
      year,
    }));

    return [...ctosPart, ...unPart];
  }, [financialRows, adminUserYears]);

  const turnovers = React.useMemo(() => {
    return columns.map((spec) => {
      if (spec.year == null) return { year: null as number | null, turnover: null as number | null };
      if (spec.kind === "ctos") {
        const row = byYear.get(spec.year);
        return { year: spec.year, turnover: row?.account.turnover ?? null };
      }
      const fs = unauditedByYear[String(spec.year)];
      const rawT = fs?.turnover;
      const t =
        rawT != null && rawT !== "" && String(rawT).trim() !== ""
          ? toNum(rawT)
          : null;
      return { year: spec.year, turnover: hasIssuerFinancialData ? t : null };
    });
  }, [columns, byYear, unauditedByYear, hasIssuerFinancialData]);

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

      if (spec.kind === "ctos") {
        if (spec.year == null) return null;
        const row = byYear.get(spec.year);
        if (!row) return null;
        const ac = row.account;
        const { bs, pl } = financialFormToBsPl({
          bsfatot: ac.bsfatot ?? 0,
          othass: ac.othass ?? 0,
          bscatot: ac.bscatot ?? 0,
          bsclbank: ac.bsclbank ?? 0,
          curlib: ac.curlib ?? 0,
          bsslltd: ac.bsslltd ?? 0,
          bsclstd: ac.bsclstd ?? 0,
          bsqpuc: ac.bsqpuc ?? 0,
          turnover: ac.turnover ?? 0,
          plnpat: ac.plnpat ?? 0,
        });
        Object.assign(bs, {
          total_assets: ac.totass,
          total_liabilities: ac.totlib,
        });
        return computeColumnMetrics(bs, pl, g);
      }

      if (spec.year == null) return null;
      if (!hasIssuerFinancialData) return null;
      const fs = unauditedByYear[String(spec.year)];
      if (!fs) return null;
      const input = financialRecordToInput(fs as Record<string, unknown>);
      const { bs, pl } = financialFormToBsPl(input);
      return computeColumnMetrics(bs, pl, g);
    });
  }, [columns, byYear, turnovers, turnoverByYear, hasIssuerFinancialData, unauditedByYear]);

  const getFsCol = React.useCallback(
    (idx: number): Record<string, unknown> | null => {
      const spec = columns[idx];
      if (!spec || spec.year == null) return null;
      if (spec.kind === "ctos") {
        const row = byYear.get(spec.year);
        return row ? ctosFinToFs(row) : null;
      }
      const fs = unauditedByYear[String(spec.year)];
      return (fs && typeof fs === "object" ? fs : null) as Record<string, unknown> | null;
    },
    [columns, byYear, unauditedByYear]
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
      return spec?.kind === "ctos" ? "Field empty in CTOS" : "Not provided in issuer form";
    }
    return fmt();
  };

  const onGetCtos = () => {
    const t = toast.loading("Fetching CTOS report…");
    createCtos.mutate(undefined, {
      onSuccess: () => {
        toast.dismiss(t);
        toast.success("CTOS report saved.");
      },
      onError: (e: Error) => {
        toast.dismiss(t);
        toast.error(e.message || "CTOS request failed");
      },
    });
  };

  const openFullReport = async () => {
    if (!latestCtos?.id) return;
    const token = await getAccessToken();
    if (!token) {
      toast.error("Not signed in");
      return;
    }
    const url = `${API_URL}/v1/admin/applications/${applicationId}/ctos-reports/${latestCtos.id}/html`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      toast.error("Could not load full report");
      return;
    }
    const html = await res.text();
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const openSubjectHtmlReport = async (reportId: string) => {
    const token = await getAccessToken();
    if (!token) {
      toast.error("Not signed in");
      return;
    }
    const url = `${API_URL}/v1/admin/applications/${applicationId}/ctos-reports/${reportId}/html`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      toast.error("Could not load report");
      return;
    }
    const html = await res.text();
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const commitGetSubjectCtos = React.useCallback(
    (row: DirectorShareholderRow, options?: { enquiryOverride: { displayName: string; idNumber: string } }) => {
      const subjectRef = ctosSubjectRefForRequest(row);
      if (!subjectRef || !row.subjectKind) return;
      const t = toast.loading("Fetching CTOS report…");
      createSubjectCtos.mutate(
        {
          subjectRef,
          subjectKind: row.subjectKind,
          ...(options?.enquiryOverride ? { enquiryOverride: options.enquiryOverride } : {}),
        },
        {
          onSuccess: () => {
            toast.dismiss(t);
            toast.success("CTOS report saved.");
          },
          onError: (e: Error) => {
            toast.dismiss(t);
            toast.error(e.message || "CTOS request failed");
          },
        }
      );
    },
    [createSubjectCtos]
  );

  const requestGetSubjectCtos = React.useCallback(
    (row: DirectorShareholderRow, options?: { enquiryOverride: { displayName: string; idNumber: string } }) => {
      const subjectRef = ctosSubjectRefForRequest(row);
      if (!subjectRef || !row.subjectKind) return;
      setSubjectCtosConfirm(
        options?.enquiryOverride
          ? { row, enquiryOverride: options.enquiryOverride }
          : { row }
      );
    },
    []
  );

  /** Short hint under label for computed rows (admin scan speed). */
  const rowLabels: { id: string; label: string; formulaHint?: string }[] = [
    { id: "pldd", label: "Financial Year End" },
    { id: "bsfatot", label: FINANCIAL_FIELD_LABELS.bsfatot },
    { id: "othass", label: FINANCIAL_FIELD_LABELS.othass },
    { id: "bscatot", label: FINANCIAL_FIELD_LABELS.bscatot },
    { id: "bsclbank", label: FINANCIAL_FIELD_LABELS.bsclbank },
    { id: "totass", label: COMPUTED_FIELD_LABELS.totass, formulaHint: "Fixed + other + current + non-current assets." },
    { id: "curlib", label: FINANCIAL_FIELD_LABELS.curlib },
    { id: "bsslltd", label: FINANCIAL_FIELD_LABELS.bsslltd },
    { id: "bsclstd", label: FINANCIAL_FIELD_LABELS.bsclstd },
    { id: "totlib", label: COMPUTED_FIELD_LABELS.totlib, formulaHint: "Current + long-term + non-current liabilities." },
    { id: "networth", label: COMPUTED_FIELD_LABELS.networth, formulaHint: "Total assets − total liabilities." },
    { id: "bsqpuc", label: FINANCIAL_FIELD_LABELS.bsqpuc },
    { id: "turnover", label: FINANCIAL_FIELD_LABELS.turnover },
    { id: "plnpbt", label: FINANCIAL_FIELD_LABELS.plnpbt },
    { id: "plnpat", label: FINANCIAL_FIELD_LABELS.plnpat },
    { id: "plnetdiv", label: FINANCIAL_FIELD_LABELS.plnetdiv },
    { id: "plyear", label: FINANCIAL_FIELD_LABELS.plyear },
    {
      id: "turnover_growth",
      label: COMPUTED_FIELD_LABELS.turnover_growth,
      formulaHint: "(This year turnover − prior year) ÷ prior year. Prior column year must be exactly one less.",
    },
    { id: "profit_margin", label: COMPUTED_FIELD_LABELS.profit_margin, formulaHint: "Profit after tax ÷ turnover." },
    {
      id: "return_of_equity",
      label: COMPUTED_FIELD_LABELS.return_of_equity,
      formulaHint: "Profit after tax ÷ paid-up capital.",
    },
    { id: "currat", label: COMPUTED_FIELD_LABELS.currat, formulaHint: "Current assets ÷ current liabilities." },
    { id: "workcap", label: COMPUTED_FIELD_LABELS.workcap, formulaHint: "Current assets − current liabilities." },
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
        if (specCol.kind === "ctos" && fs && ctosFlatNumericPresent(fs, "totass")) {
          const raw = toNum(fs.totass);
          return raw === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(raw, { decimals: 0 });
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
        if (specCol.kind === "ctos" && fs && ctosFlatNumericPresent(fs, "totlib")) {
          const raw = toNum(fs.totlib);
          return raw === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(raw, { decimals: 0 });
        }
        if (!computed) return "N/A";
        const n = computed.totlib;
        return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
      }
      case "networth": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (specCol.kind === "ctos" && fs && ctosFlatNumericPresent(fs, "networth")) {
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
        if (specCol.kind === "ctos" && fs && ctosFlatNumericPresent(fs, "turnover_growth")) {
          return formatNumber(toNum(fs.turnover_growth), 2) + "%";
        }
        if (!computed || computed.turnover_growth == null) return "N/A";
        return formatNumber(computed.turnover_growth * 100, 2) + "%";
      }
      case "profit_margin": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (specCol.kind === "ctos" && fs && ctosFlatNumericPresent(fs, "profit_margin")) {
          return formatNumber(toNum(fs.profit_margin), 2) + "%";
        }
        if (!computed || computed.profit_margin == null) return "N/A";
        return formatNumber(computed.profit_margin * 100, 2) + "%";
      }
      case "return_of_equity": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (specCol.kind === "ctos" && fs && ctosFlatNumericPresent(fs, "return_on_equity")) {
          return formatNumber(toNum(fs.return_on_equity), 2) + "%";
        }
        if (!computed || computed.return_of_equity == null) return "N/A";
        return formatNumber(computed.return_of_equity * 100, 2) + "%";
      }
      case "currat": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (specCol.kind === "ctos" && fs && ctosFlatNumericPresent(fs, "currat")) {
          return formatNumber(toNum(fs.currat), 2);
        }
        if (!computed || computed.currat == null) return "N/A";
        return formatNumber(computed.currat, 2);
      }
      case "workcap": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (specCol.kind === "ctos" && fs && ctosFlatNumericPresent(fs, "workcap")) {
          return formatCurrency(toNum(fs.workcap), { decimals: 0 });
        }
        if (!computed) return "N/A";
        return formatCurrency(computed.workcap, { decimals: 0 });
      }
      default:
        return "—";
    }
  };

  const fetchedLabel = latestCtos?.fetched_at
    ? new Date(latestCtos.fetched_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  const hadCtosUnauditedOverride = adminUserYears.some((y) => ctosFinancialYearsSet.has(y));

  const isMutedFinancialCell = (text: string) =>
    text === "—" ||
    text === "N/A" ||
    text === "Missing in CTOS extract" ||
    text === "Field empty in CTOS" ||
    text === "Not provided in issuer form";

  return (
    <>
      <ReviewFieldBlock title="Organization CTOS">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="m-0 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{CTOS_UI.fetchReport}</span> asks CTOS for a{" "}
                <span className="font-medium text-foreground">new</span> organization report.{" "}
                <span className="font-medium text-foreground">Financial Summary</span> and{" "}
                <span className="font-medium text-foreground">Director and Shareholders</span> use the organization data CTOS
                returns. <span className="font-medium text-foreground">{CTOS_UI.viewReport}</span> opens the saved report from the{" "}
                <span className="font-medium text-foreground">last successful fetch</span> in a new browser tab (read-only). It
                does not run another enquiry.
              </p>
              {ctosFetchState === "not_pulled" || hadCtosUnauditedOverride ? (
                <div className="space-y-1 rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
                  {ctosFetchState === "not_pulled" ? <p className="m-0">Organization CTOS has not been fetched for this application yet.</p> : null}
                  {hadCtosUnauditedOverride ? <p className="m-0">Latest year already exists in CTOS.</p> : null}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-3 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0 lg:items-end">
              <p className="m-0 inline-flex max-w-full flex-wrap items-baseline justify-end gap-x-3 gap-y-1 text-right text-xs leading-relaxed">
                {fetchedLabel ? (
                  <>
                    <span className="shrink-0 font-medium text-foreground">Last organization CTOS fetch</span>
                    <span className="min-w-0 tabular-nums text-muted-foreground">{fetchedLabel}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">No organization CTOS snapshot yet.</span>
                )}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={CTOS_ACTION_BUTTON_COMPACT_CLASSNAME}
                  disabled={!latestCtos?.has_report_html || ctosLoading}
                  onClick={() => void openFullReport()}
                >
                  {CTOS_UI.viewReport}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className={CTOS_ACTION_BUTTON_COMPACT_CLASSNAME}
                  disabled={createCtos.isPending || ctosLoading}
                  onClick={() => setOrgCtosConfirmOpen(true)}
                >
                  {createCtos.isPending ? CTOS_UI.fetching : CTOS_UI.fetchReport}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ReviewFieldBlock>

      <ReviewFieldBlock title="Financial Summary">
        <div className={applicationTableWrapperClass}>
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full min-w-[760px] text-[15px]">
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
                        "w-[15.5%] align-middle text-right tabular-nums",
                        i < columns.length - 1 ? "border-r border-border" : "",
                        financialSummaryColumnShellClass(spec.kind, i, spec.year)
                      )}
                    >
                      <span className={spec.year != null ? "text-foreground" : "text-muted-foreground"}>
                        {spec.kind === "unaudited" && spec.year != null && financialQuestionnaire ? (
                          <span className="flex flex-col items-end gap-0.5">
                            <span>{`FY${spec.year}`}</span>
                            <span className="text-[11px] font-normal leading-tight text-muted-foreground">
                              {formatFinancialFyPeriodDisplay(financialQuestionnaire, spec.year)}
                            </span>
                          </span>
                        ) : spec.year != null ? (
                          String(spec.year)
                        ) : spec.kind === "ctos" ? (
                          "No year"
                        ) : (
                          HEADER_PLACEHOLDER
                        )}
                      </span>
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
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 font-semibold text-[11px] leading-tight px-2.5 py-0.5 rounded-md shadow-none",
                            spec.kind === "ctos" && spec.year != null
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                              : spec.kind === "ctos"
                                ? "border-border bg-muted/40 text-muted-foreground"
                                : "border-border bg-muted/50 text-foreground"
                          )}
                        >
                          {spec.kind === "ctos" ? "CTOS" : "User Input"}
                        </Badge>
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

      <ReviewFieldBlock title="Company Credit Score">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs text-muted-foreground">Last updated —</span>
          <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" disabled>
            Get Updated Credit Score
          </Button>
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden min-h-[80px] flex items-center justify-center">
          <p className={`${reviewEmptyStateClass} py-6`}>
            Credit score data will be populated from external API (e.g. CTOS).
          </p>
        </div>
      </ReviewFieldBlock>

      <ReviewFieldBlock title="Director and Shareholders">
        {directorDisplayRows.length > 0 ? (
          <div className={applicationTableWrapperClass}>
            <Table className="text-[15px]">
              <TableHeader className={applicationTableHeaderBgClass}>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className={applicationTableHeaderClass}>Name</TableHead>
                  <TableHead className={applicationTableHeaderClass}>Role</TableHead>
                  <TableHead className={applicationTableHeaderClass}>IC / SSM</TableHead>
                  <TableHead className={applicationTableHeaderClass}>Email</TableHead>
                  <TableHead className={applicationTableHeaderClass}>KYC / KYB status</TableHead>
                  <TableHead className={applicationTableHeaderClass}>Last subject fetch</TableHead>
                  <TableHead className={applicationTableHeaderClass}>{CTOS_UI.viewReport}</TableHead>
                  <TableHead className={`${applicationTableHeaderClass} w-[140px]`}>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directorDisplayRows.map((row: DirectorShareholderDisplayRow) => {
                  const subjectRow = displayDirectorRowToSubjectRow(row);
                  const icSm = row.idNumber?.trim() || row.registrationNumber?.trim() || "";
                  const subjectSnap = lookupSubjectReportSnap(
                    subjectReportByRef,
                    subjectRow.icOrSsm,
                    subjectRow.subjectRef
                  );
                  const canViewSubject = Boolean(subjectSnap?.has_report_html);
                  const approvedLike = row.status === "APPROVED" || row.status === "Approved";
                  return (
                    <TableRow key={row.id} className={applicationTableRowClass}>
                      <TableCell className={`${applicationTableCellClass} font-medium`}>{row.name}</TableCell>
                      <TableCell className={applicationTableCellClass}>{row.role}</TableCell>
                      <TableCell className={`${applicationTableCellClass} tabular-nums`}>
                        {icSm || "—"}
                      </TableCell>
                      <TableCell className={applicationTableCellClass}>
                        {row.email.trim() ? row.email : "—"}
                      </TableCell>
                      <TableCell className={applicationTableCellClass}>
                        {approvedLike ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                          >
                            <CheckCircleIcon className="h-3 w-3 mr-1 inline" />
                            {row.status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{row.status}</span>
                        )}
                      </TableCell>
                      <TableCell className={applicationTableCellClass}>
                        {subjectLastFetchDisplay({
                          subjectRef: ctosSubjectReportLookupKey(subjectRow.icOrSsm, subjectRow.subjectRef),
                          snap: subjectSnap,
                        })}
                      </TableCell>
                      <TableCell className={applicationTableCellClass}>
                        <Button
                          variant="outline"
                          size="sm"
                          className={CTOS_ACTION_BUTTON_COMPACT_CLASSNAME}
                          disabled={
                            !ctosSubjectRefForRequest(subjectRow) ||
                            !canViewSubject ||
                            ctosSubjectLoading ||
                            !subjectSnap?.id
                          }
                          onClick={() => void openSubjectHtmlReport(subjectSnap!.id)}
                        >
                          {CTOS_UI.viewReport}
                        </Button>
                      </TableCell>
                      <TableCell className={applicationTableCellClass}>
                        <Button
                          variant="secondary"
                          size="sm"
                          className={CTOS_ACTION_BUTTON_COMPACT_CLASSNAME}
                          disabled={
                            !ctosSubjectRefForRequest(subjectRow) ||
                            !subjectRow.subjectKind ||
                            createSubjectCtos.isPending ||
                            ctosSubjectLoading
                          }
                          onClick={() => {
                            if (!subjectRow.icOrSsm) return;
                            requestGetSubjectCtos(subjectRow, {
                              enquiryOverride: {
                                displayName: subjectRow.name,
                                idNumber: subjectRow.icOrSsm,
                              },
                            });
                          }}
                        >
                          {createSubjectCtos.isPending ? CTOS_UI.fetching : CTOS_UI.fetchReport}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card min-h-[80px] flex items-center justify-center">
            <p className={`${reviewEmptyStateClass} py-6`}>No director or shareholder data.</p>
          </div>
        )}
      </ReviewFieldBlock>

      <ReviewFieldBlock title="Cashsouk Intelligence">
        <p className="text-xs text-muted-foreground mb-3">Score: —</p>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-6">
            <p className={reviewEmptyStateClass}>
              In-house decisioning analysis component will be integrated here.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <Button variant="outline" size="sm" className="rounded-lg" disabled>
                Action
              </Button>
              <Button size="sm" className="rounded-lg bg-primary text-primary-foreground" disabled>
                Approve
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg text-destructive" disabled>
                Reject (need to add note)
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg" disabled>
                Request amendment
              </Button>
            </div>
          </div>
        </div>
      </ReviewFieldBlock>

      <AlertDialog open={orgCtosConfirmOpen} onOpenChange={setOrgCtosConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{CTOS_CONFIRM.title}</AlertDialogTitle>
            <AlertDialogDescription>{CTOS_CONFIRM.organizationDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" disabled={createCtos.isPending}>
              {CTOS_CONFIRM.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "secondary" }), "rounded-lg")}
              disabled={createCtos.isPending}
              onClick={() => {
                onGetCtos();
              }}
            >
              {createCtos.isPending ? CTOS_UI.fetching : CTOS_CONFIRM.primaryAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={subjectCtosConfirm != null}
        onOpenChange={(open) => {
          if (!open) setSubjectCtosConfirm(null);
        }}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{CTOS_CONFIRM.title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {subjectCtosConfirm ? (
                  <>
                    <p className="m-0">{CTOS_CONFIRM.subjectLead}</p>
                    <p className="m-0">
                      <span className="font-medium text-foreground">Name:</span> {subjectCtosConfirm.row.name}
                    </p>
                    <p className="m-0">
                      <span className="font-medium text-foreground">Kind:</span>{" "}
                      {subjectCtosConfirm.row.subjectKind ?? "—"}
                    </p>
                    {subjectCtosConfirm.enquiryOverride ? (
                      <p className="m-0">
                        <span className="font-medium text-foreground">Enquiry ID:</span>{" "}
                        {subjectCtosConfirm.enquiryOverride.idNumber}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" disabled={createSubjectCtos.isPending}>
              {CTOS_CONFIRM.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "secondary" }), "rounded-lg")}
              disabled={createSubjectCtos.isPending}
              onClick={() => {
                if (!subjectCtosConfirm) return;
                commitGetSubjectCtos(
                  subjectCtosConfirm.row,
                  subjectCtosConfirm.enquiryOverride
                    ? { enquiryOverride: subjectCtosConfirm.enquiryOverride }
                    : undefined
                );
                setSubjectCtosConfirm(null);
              }}
            >
              {createSubjectCtos.isPending ? CTOS_UI.fetching : CTOS_CONFIRM.primaryAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
