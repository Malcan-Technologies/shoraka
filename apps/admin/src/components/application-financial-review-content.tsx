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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { CheckCircleIcon, ChevronDownIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { formatCurrency, formatNumber, useAuthToken } from "@cashsouk/config";
import {
  FINANCIAL_FIELD_LABELS,
  computeColumnMetrics,
  computeTurnoverGrowth,
  financialFormToBsPl,
  getCtosLatestYear,
  getLatestThreeCtosYears,
  validateUnauditedColumn,
  normalizeFinancialStatementsQuestionnaire,
  type ColumnComputedMetrics,
  type FinancialStatementsInput,
  type FinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import { toast } from "sonner";
import {
  useAdminApplicationCtosReports,
  useAdminApplicationCtosSubjectReports,
  useCreateAdminApplicationCtosReport,
  useCreateAdminApplicationCtosSubjectReport,
} from "@/hooks/use-admin-application-ctos-reports";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Year row placeholder when no year (em dash). */
const HEADER_PLACEHOLDER = "\u2014";

type CtosFetchState = "not_pulled" | "no_records" | "has_data";

function getUnauditedDisplayStatus(
  year: number | null,
  ctosLatestYear: number | null,
  questionnaire: FinancialStatementsQuestionnaire | null,
  ctosFetchState: CtosFetchState
): string {
  if (year == null) return "Not provided";
  if (ctosFetchState === "not_pulled" || ctosFetchState === "no_records" || ctosLatestYear === null) {
    return "Needs review";
  }
  const Y = year;
  const X = ctosLatestYear;
  if (Y === X + 1) return "Valid";
  if (questionnaire?.submitted_this_financial_year && Y > X) return "Needs review";
  if (Y < X) return "Invalid";
  if (Y > X + 1) return "Invalid";
  return "Needs review";
}

function adminCtosStatusLabel(spec: { kind: string; year: number | null }, ctosFetchState: CtosFetchState): string {
  if (spec.kind !== "ctos") return "";
  if (ctosFetchState === "not_pulled") return "Not fetched";
  if (ctosFetchState === "no_records") return "No record found";
  if (spec.year == null) return "—";
  return "Verified";
}

function adminColumnStatusLabel(
  spec: ColumnSpec,
  ctosFetchState: CtosFetchState,
  ctosLatestYear: number | null,
  questionnaire: FinancialStatementsQuestionnaire | null
): string {
  if (spec.kind === "ctos") {
    return adminCtosStatusLabel(spec, ctosFetchState);
  }
  return getUnauditedDisplayStatus(spec.year, ctosLatestYear, questionnaire, ctosFetchState);
}

function financialSummaryStatusToneClass(statusLabel: string): string {
  if (statusLabel === "Verified" || statusLabel === "Valid") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
  }
  if (statusLabel === "Needs review") {
    return "border-amber-500/45 bg-amber-500/10 text-amber-950 dark:text-amber-100";
  }
  if (statusLabel === "Invalid") {
    return "border-destructive/45 bg-destructive/10 text-destructive";
  }
  return "border-border bg-muted/50 text-muted-foreground";
}

/** Copy for legend and tooltips (single source). One-line definition of what the status is. */
const FINANCIAL_SUMMARY_STATUS_EXPLANATIONS: Record<string, string> = {
  "Not fetched": "CTOS has not been retrieved for this application.",
  "No record found": "CTOS has no financial records on file for this organization.",
  Verified: "This column has official financial data from CTOS for the year shown.",
  "\u2014": "This CTOS column has no reporting year in this slot.",
  "Not provided": "This unaudited column has no data entered.",
  Valid: "The unaudited year is the year immediately after the latest CTOS year.",
  "Needs review": "This unaudited year could not be confirmed automatically against CTOS.",
  Invalid: "This unaudited year is outside the allowed range relative to the latest CTOS year.",
};

function getFinancialSummaryStatusExplanation(statusLabel: string): string {
  return FINANCIAL_SUMMARY_STATUS_EXPLANATIONS[statusLabel] ?? "Definition of this status label.";
}

function FinancialSummaryStatusBadge({ statusLabel }: { statusLabel: string }) {
  const main = getFinancialSummaryStatusExplanation(statusLabel);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex max-w-full cursor-help">
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 font-semibold text-[11px] leading-tight px-2.5 py-0.5 rounded-md shadow-none",
              financialSummaryStatusToneClass(statusLabel)
            )}
          >
            {statusLabel}
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-sm p-3 text-left text-xs font-normal leading-relaxed text-primary-foreground"
      >
        <p className="m-0">{main}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** Legend order: confidence / outcome first, then empty and CTOS pipeline. */
const FINANCIAL_SUMMARY_LEGEND_ORDER: { term: string }[] = [
  { term: "Verified" },
  { term: "Valid" },
  { term: "Needs review" },
  { term: "Invalid" },
  { term: "Not provided" },
  { term: "No record found" },
  { term: "Not fetched" },
  { term: "\u2014" },
];

function financialSummaryColumnShellClass(kind: "ctos" | "unaudited", colIndex: number, extra?: string) {
  const isFirstUnaudited = kind === "unaudited" && colIndex === 3;
  return cn(
    kind === "ctos" ? "bg-muted/25" : "bg-background/80",
    isFirstUnaudited && "border-l-2 border-l-primary/20",
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

interface CtosFinRow {
  reporting_year: number | null;
  financial_year_end_date: string | null;
  balance_sheet_date: string | null;
  balance_sheet: {
    fixed_assets: number | null;
    other_assets: number | null;
    current_assets: number | null;
    non_current_assets: number | null;
    total_assets: number | null;
    current_liabilities: number | null;
    long_term_liabilities: number | null;
    non_current_liabilities: number | null;
    total_liabilities: number | null;
    equity: number | null;
  };
  profit_and_loss: {
    revenue: number | null;
    profit_before_tax: number | null;
    profit_after_tax: number | null;
    net_dividend: number | null;
    profit_line_amount: number | null;
  };
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

function normalizePlddToYearString(val: unknown): string {
  if (val === undefined || val === null) return "";
  const s = String(val).trim();
  if (s === "") return "";
  if (/^\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 4);
  const asDate = new Date(s);
  if (!Number.isNaN(asDate.getTime())) return String(asDate.getFullYear());
  const m = s.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : "";
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
  const flat = parseFinancialStatements(financialRaw);
  const yStr = normalizePlddToYearString(flat.pldd);
  const hasOther =
    yStr &&
    Object.keys(flat).some((k) => {
      if (k === "pldd") return false;
      const v = flat[k];
      return v != null && String(v).trim() !== "";
    });
  if (!yStr || !hasOther) {
    return { questionnaire: null, unauditedByYear: {} };
  }
  const y = parseInt(yStr, 10);
  return {
    questionnaire: {
      latest_financial_year: y,
      submitted_this_financial_year: false,
      has_data_for_next_financial_year: false,
    },
    unauditedByYear: { [yStr]: flat as Record<string, unknown> },
  };
}

export function firstUnauditedYearFinancialBlock(raw: unknown): Record<string, unknown> {
  const { unauditedByYear } = extractQuestionnaireAndUnaudited(raw);
  const years = Object.keys(unauditedByYear).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  if (years.length === 0) return {};
  const block = unauditedByYear[years[0]];
  return block && typeof block === "object" ? (block as Record<string, unknown>) : {};
}

type ColumnSpec =
  | { kind: "ctos"; year: number | null }
  | {
      kind: "unaudited";
      year: number | null;
      validation: ReturnType<typeof validateUnauditedColumn>;
    };

function ctosFinToFs(r: CtosFinRow): Record<string, unknown> {
  const bs = r.balance_sheet;
  const pl = r.profit_and_loss;
  return {
    pldd: r.financial_year_end_date ?? "",
    bsdd: r.balance_sheet_date ?? "",
    bsfatot: bs.fixed_assets ?? "",
    othass: bs.other_assets ?? "",
    bscatot: bs.current_assets ?? "",
    bsclbank: bs.non_current_assets ?? "",
    curlib: bs.current_liabilities ?? "",
    bsslltd: bs.long_term_liabilities ?? "",
    bsclstd: bs.non_current_liabilities ?? "",
    bsqpuc: bs.equity ?? "",
    turnover: pl.revenue ?? "",
    plnpbt: pl.profit_before_tax ?? "",
    plnpat: pl.profit_after_tax ?? "",
    plnetdiv: pl.net_dividend ?? "",
    plyear: pl.profit_line_amount ?? "",
  };
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
  verificationLabel: "KYC" | "KYB";
  verificationStatus: string | null;
  /** RegTank EOD… or COD…; Get/View CTOS subject report when set. */
  subjectRef: string | null;
  subjectKind: "INDIVIDUAL" | "CORPORATE" | null;
}

/** TEMP: set to false to use real issuer organization data. Remove when CTOS cross-check table is done. */
const USE_MOCK_DIRECTOR_SHAREHOLDER_ROWS = true;

const MOCK_DIRECTOR_SHAREHOLDER_ROWS: DirectorShareholderRow[] = [
  {
    id: "mock-ds-1",
    name: "Ahmad bin Hassan",
    role: "Director",
    ownership: null,
    verificationLabel: "KYC",
    verificationStatus: "APPROVED",
    subjectRef: null,
    subjectKind: "INDIVIDUAL",
  },
  {
    id: "mock-ds-2",
    name: "Sarah Lim Wei Ting",
    role: "Director, Shareholder",
    ownership: "40% ownership",
    verificationLabel: "KYC",
    verificationStatus: "Approved",
    subjectRef: null,
    subjectKind: "INDIVIDUAL",
  },
  {
    id: "mock-ds-3",
    name: "Pacific Ventures Sdn Bhd",
    role: "Corporate Shareholder",
    ownership: "25% ownership",
    verificationLabel: "KYB",
    verificationStatus: "PENDING_REVIEW",
    subjectRef: null,
    subjectKind: "CORPORATE",
  },
  {
    id: "mock-ds-4",
    name: "James Koh",
    role: "Shareholder",
    ownership: "15% ownership",
    verificationLabel: "KYC",
    verificationStatus: "APPROVED",
    subjectRef: null,
    subjectKind: "INDIVIDUAL",
  },
];

/**
 * Per-field issuer vs CTOS comparison. `na` renders as an em dash (no badge). Mock rows set sample outcomes; live rows
 * stay `na` until subject CTOS fields are parsed and rules run (see blurb under CTOS subject table).
 */
type CtosDimensionCheck = "match" | "review" | "mismatch" | "na";

interface CtosDirectorShareholderCrossRow {
  id: string;
  /** Links to `DirectorShareholderRow.id` for subject CTOS actions. */
  profileRowId: string;
  ctosDisplayName: string | null;
  ctosDisplayRole: string | null;
  /** Shareholding as stated in subject CTOS extract, when available. */
  ctosOwnership: string | null;
  nameCheck: CtosDimensionCheck;
  roleCheck: CtosDimensionCheck;
  ownershipCheck: CtosDimensionCheck;
  lastSubjectFetchLabel: string | null;
}

const MOCK_CTOS_DIRECTOR_CROSS_ROWS: CtosDirectorShareholderCrossRow[] = [
  {
    id: "ctos-x-1",
    profileRowId: "mock-ds-1",
    ctosDisplayName: "AHMAD BIN HASSAN",
    ctosDisplayRole: "Director",
    ctosOwnership: null,
    nameCheck: "match",
    roleCheck: "match",
    ownershipCheck: "na",
    lastSubjectFetchLabel: "Apr 10, 2026, 2:00 PM",
  },
  {
    id: "ctos-x-2",
    profileRowId: "mock-ds-2",
    ctosDisplayName: "LIM WEI TING SARAH",
    ctosDisplayRole: "Director",
    ctosOwnership: "40% ownership",
    nameCheck: "review",
    roleCheck: "match",
    ownershipCheck: "match",
    lastSubjectFetchLabel: null,
  },
  {
    id: "ctos-x-3",
    profileRowId: "mock-ds-3",
    ctosDisplayName: "PACIFIC VENTURES SDN BHD",
    ctosDisplayRole: "Shareholder",
    ctosOwnership: "25% ownership",
    nameCheck: "match",
    roleCheck: "match",
    ownershipCheck: "match",
    lastSubjectFetchLabel: "Apr 9, 2026, 11:15 AM",
  },
  {
    id: "ctos-x-4",
    profileRowId: "mock-ds-4",
    ctosDisplayName: "KOH JAMES",
    ctosDisplayRole: "Shareholder",
    ctosOwnership: "10% ownership",
    nameCheck: "match",
    roleCheck: "match",
    ownershipCheck: "mismatch",
    lastSubjectFetchLabel: "Apr 8, 2026, 9:30 AM",
  },
];

function dimensionCheckBadgeClass(c: CtosDimensionCheck): string {
  if (c === "na") return "";
  if (c === "match") {
    return "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100";
  }
  if (c === "review") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100";
  }
  if (c === "mismatch") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  return "border-border bg-muted/50 text-muted-foreground";
}

function dimensionCheckLabel(c: CtosDimensionCheck): string {
  if (c === "match") return "Match";
  if (c === "review") return "Needs review";
  if (c === "mismatch") return "Mismatch";
  return "";
}

function dimensionCheckDisplay(check: CtosDimensionCheck): React.ReactNode {
  if (check === "na") {
    return <span className="text-muted-foreground">{HEADER_PLACEHOLDER}</span>;
  }
  return (
    <Badge
      variant="outline"
      className={cn("font-semibold text-[11px] leading-tight", dimensionCheckBadgeClass(check))}
    >
      {dimensionCheckLabel(check)}
    </Badge>
  );
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

function extractOwnershipFromRole(role: string | null | undefined): string | null {
  if (!role) return null;
  const match = role.match(/\((\d+)%\)/);
  if (!match) return null;
  return `${match[1]}% ownership`;
}

function getRoleLabel(role: string | null | undefined, isCorporate: boolean): string {
  if (isCorporate) return "Corporate Shareholder";
  if (!role) return "Director";
  const r = String(role).toLowerCase();
  const isDir = r.includes("director");
  const isSh = r.includes("shareholder");
  if (isDir && isSh) return "Director, Shareholder";
  if (isSh) return "Shareholder";
  return "Director";
}

function findKycStatusForEod(
  directorKycStatus: Record<string, unknown> | null | undefined,
  eod: string
): string | null {
  if (!eod) return null;
  const dirs = Array.isArray(directorKycStatus?.directors)
    ? (directorKycStatus!.directors as Record<string, unknown>[])
    : [];
  for (const d of dirs) {
    if (String(d.eodRequestId ?? "").trim() === eod && d.kycStatus) return String(d.kycStatus);
  }
  const sh = Array.isArray(directorKycStatus?.individualShareholders)
    ? (directorKycStatus!.individualShareholders as Record<string, unknown>[])
    : [];
  for (const s of sh) {
    if (String(s.eodRequestId ?? "").trim() === eod && s.kycStatus) return String(s.kycStatus);
  }
  return null;
}

function personNameFromCe(p: Record<string, unknown>): string {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const full = String(info?.fullName ?? "").trim();
  if (full) return full;
  const first = String(info?.firstName ?? "").trim();
  const last = String(info?.lastName ?? "").trim();
  const joined = [first, last].filter(Boolean).join(" ");
  return joined || "Unknown";
}

function ownershipFromCePerson(p: Record<string, unknown>): string | null {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const formContent = (info?.formContent ?? p.formContent) as Record<string, unknown> | undefined;
  const content = Array.isArray(formContent?.content)
    ? (formContent.content as Array<{ fieldName?: string; fieldValue?: string }>)
    : [];
  const shareField = content.find((f) => f.fieldName === "% of Shares");
  return shareField?.fieldValue ? `${shareField.fieldValue}% ownership` : null;
}

function rowsFromCorporateEntities(
  directors: Record<string, unknown>[],
  shareholders: Record<string, unknown>[],
  corpShareholders: Record<string, unknown>[],
  directorKycStatus: Record<string, unknown> | null | undefined,
  directorAmlStatus: Record<string, unknown> | null | undefined
): DirectorShareholderRow[] {
  const rows: DirectorShareholderRow[] = [];
  let idx = 0;
  const businessAml = Array.isArray(directorAmlStatus?.businessShareholders)
    ? (directorAmlStatus!.businessShareholders as Record<string, unknown>[])
    : [];

  const getCorpOwnership = (corp: Record<string, unknown>): string | null => {
    const formContent = corp.formContent as Record<string, unknown> | undefined;
    const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
    for (const area of displayAreas) {
      const content = Array.isArray((area as Record<string, unknown>)?.content)
        ? ((area as Record<string, unknown>).content as Array<{ fieldName?: string; fieldValue?: string }>)
        : [];
      const shareField = content.find((f) => f.fieldName === "% of Shares");
      if (shareField?.fieldValue) return `${shareField.fieldValue}% ownership`;
    }
    const pct = corp.share_percentage ?? corp.sharePercentage ?? corp.percentage;
    if (pct != null) return `${pct}% ownership`;
    return null;
  };

  const getCorpName = (corp: Record<string, unknown>): string => {
    const formContent = corp.formContent as Record<string, unknown> | undefined;
    const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
    const basicInfo = displayAreas.find(
      (a: Record<string, unknown>) => a.displayArea === "Basic Information Setting"
    ) as { content?: Array<{ fieldName?: string; fieldValue?: string }> } | undefined;
    const content = Array.isArray(basicInfo?.content) ? basicInfo.content : [];
    const businessNameField = content.find((f) => f.fieldName === "Business Name");
    if (businessNameField?.fieldValue) return String(businessNameField.fieldValue);
    return String(corp.companyName || corp.businessName || "Unknown");
  };

  for (const p of directors) {
    const ref = String(p.eodRequestId ?? "").trim();
    const kycSt = ref ? findKycStatusForEod(directorKycStatus, ref) : null;
    const st = (p.status ?? p.approveStatus) ? String(p.status ?? p.approveStatus) : null;
    rows.push({
      id: ref || `ce-dir-${idx++}`,
      name: personNameFromCe(p),
      role: "Director",
      ownership: ownershipFromCePerson(p),
      verificationLabel: "KYC",
      verificationStatus: kycSt ?? st,
      subjectRef: ref || null,
      subjectKind: ref ? "INDIVIDUAL" : null,
    });
  }
  for (const p of shareholders) {
    const ref = String(p.eodRequestId ?? "").trim();
    const kycSt = ref ? findKycStatusForEod(directorKycStatus, ref) : null;
    const st = (p.status ?? p.approveStatus) ? String(p.status ?? p.approveStatus) : null;
    rows.push({
      id: ref || `ce-sh-${idx++}`,
      name: personNameFromCe(p),
      role: "Shareholder",
      ownership: ownershipFromCePerson(p),
      verificationLabel: "KYC",
      verificationStatus: kycSt ?? st,
      subjectRef: ref || null,
      subjectKind: ref ? "INDIVIDUAL" : null,
    });
  }
  for (const corp of corpShareholders) {
    const codRequestId = String(
      (corp.corporateOnboardingRequest as Record<string, unknown> | undefined)?.requestId ?? corp.requestId ?? ""
    ).trim();
    const matchingAml = businessAml.find(
      (b) => b.codRequestId === codRequestId || (corp.kybId && b.kybId === corp.kybId)
    );
    const corpPct = getCorpOwnership(corp);
    const ownership =
      matchingAml?.sharePercentage != null
        ? `${matchingAml.sharePercentage}% ownership`
        : corpPct;
    const amlStatus = matchingAml?.amlStatus ? String(matchingAml.amlStatus) : null;
    const codStatus = corp.status ?? corp.approveStatus;
    rows.push({
      id: codRequestId || `corp-${idx++}`,
      name: getCorpName(corp),
      role: "Corporate Shareholder",
      ownership,
      verificationLabel: "KYB",
      verificationStatus: amlStatus ?? (codStatus ? String(codStatus) : null),
      subjectRef: codRequestId || null,
      subjectKind: codRequestId ? "CORPORATE" : null,
    });
  }
  return rows;
}

function rowsFromKycOnly(
  directorKycStatus: Record<string, unknown> | null | undefined,
  directorAmlStatus: Record<string, unknown> | null | undefined,
  corpShareholders: Record<string, unknown>[]
): DirectorShareholderRow[] {
  const rows: DirectorShareholderRow[] = [];
  let idx = 0;
  const kycDirectors = Array.isArray(directorKycStatus?.directors)
    ? (directorKycStatus!.directors as Record<string, unknown>[])
    : [];
  const kycShareholders = Array.isArray(directorKycStatus?.individualShareholders)
    ? (directorKycStatus!.individualShareholders as Record<string, unknown>[])
    : [];
  const businessAml = Array.isArray(directorAmlStatus?.businessShareholders)
    ? (directorAmlStatus!.businessShareholders as Record<string, unknown>[])
    : [];

  const getCorpOwnership = (corp: Record<string, unknown>): string | null => {
    const formContent = corp.formContent as Record<string, unknown> | undefined;
    const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
    for (const area of displayAreas) {
      const content = Array.isArray((area as Record<string, unknown>)?.content)
        ? ((area as Record<string, unknown>).content as Array<{ fieldName?: string; fieldValue?: string }>)
        : [];
      const shareField = content.find((f) => f.fieldName === "% of Shares");
      if (shareField?.fieldValue) return `${shareField.fieldValue}% ownership`;
    }
    return null;
  };

  const getCorpName = (corp: Record<string, unknown>): string => {
    const formContent = corp.formContent as Record<string, unknown> | undefined;
    const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
    const basicInfo = displayAreas.find(
      (a: Record<string, unknown>) => a.displayArea === "Basic Information Setting"
    ) as { content?: Array<{ fieldName?: string; fieldValue?: string }> } | undefined;
    const content = Array.isArray(basicInfo?.content) ? basicInfo.content : [];
    const businessNameField = content.find((f) => f.fieldName === "Business Name");
    if (businessNameField?.fieldValue) return String(businessNameField.fieldValue);
    return String(corp.companyName || corp.businessName || "Unknown");
  };

  for (const d of kycDirectors) {
    const ref = String(d.eodRequestId ?? "").trim();
    const roleStr = d.role ? String(d.role) : "";
    rows.push({
      id: ref || `kyc-d-${idx++}`,
      name: String(d.name || "Unknown"),
      role: getRoleLabel(roleStr, false),
      ownership: extractOwnershipFromRole(roleStr),
      verificationLabel: "KYC",
      verificationStatus: d.kycStatus ? String(d.kycStatus) : null,
      subjectRef: ref || null,
      subjectKind: ref ? "INDIVIDUAL" : null,
    });
  }
  for (const s of kycShareholders) {
    const ref = String(s.eodRequestId ?? "").trim();
    const roleStr = s.role ? String(s.role) : "";
    rows.push({
      id: ref || `kyc-s-${idx++}`,
      name: String(s.name || "Unknown"),
      role: getRoleLabel(roleStr, false),
      ownership: extractOwnershipFromRole(roleStr),
      verificationLabel: "KYC",
      verificationStatus: s.kycStatus ? String(s.kycStatus) : null,
      subjectRef: ref || null,
      subjectKind: ref ? "INDIVIDUAL" : null,
    });
  }
  for (const corp of corpShareholders) {
    const codRequestId = String(
      (corp.corporateOnboardingRequest as Record<string, unknown> | undefined)?.requestId ?? corp.requestId ?? ""
    ).trim();
    const matchingAml = businessAml.find(
      (b) => b.codRequestId === codRequestId || (corp.kybId && b.kybId === corp.kybId)
    );
    const corpPct = getCorpOwnership(corp);
    const ownership =
      matchingAml?.sharePercentage != null
        ? `${matchingAml.sharePercentage}% ownership`
        : corpPct;
    const amlStatus = matchingAml?.amlStatus ? String(matchingAml.amlStatus) : null;
    const codStatus = corp.status ?? corp.approveStatus;
    rows.push({
      id: codRequestId || `corp-${idx++}`,
      name: getCorpName(corp),
      role: "Corporate Shareholder",
      ownership,
      verificationLabel: "KYB",
      verificationStatus: amlStatus ?? (codStatus ? String(codStatus) : null),
      subjectRef: codRequestId || null,
      subjectKind: codRequestId ? "CORPORATE" : null,
    });
  }
  return rows;
}

export function extractDirectorShareholders(
  issuerOrg: {
    corporate_entities?: unknown;
    director_kyc_status?: unknown;
    director_aml_status?: unknown;
  } | null | undefined
): DirectorShareholderRow[] {
  const corporateEntities = issuerOrg?.corporate_entities as Record<string, unknown> | null | undefined;
  const directorKycStatus = issuerOrg?.director_kyc_status as Record<string, unknown> | null | undefined;
  const directorAmlStatus = issuerOrg?.director_aml_status as Record<string, unknown> | null | undefined;

  const directors = Array.isArray(corporateEntities?.directors)
    ? (corporateEntities!.directors as Record<string, unknown>[])
    : [];
  const shareholders = Array.isArray(corporateEntities?.shareholders)
    ? (corporateEntities!.shareholders as Record<string, unknown>[])
    : [];
  const corpShareholders = Array.isArray(corporateEntities?.corporateShareholders)
    ? (corporateEntities!.corporateShareholders as Record<string, unknown>[])
    : [];

  if (directors.length > 0 || shareholders.length > 0 || corpShareholders.length > 0) {
    return rowsFromCorporateEntities(directors, shareholders, corpShareholders, directorKycStatus, directorAmlStatus);
  }
  return rowsFromKycOnly(directorKycStatus, directorAmlStatus, corpShareholders);
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
  const [financialSummaryLegendOpen, setFinancialSummaryLegendOpen] = React.useState(false);
  const [orgCtosConfirmOpen, setOrgCtosConfirmOpen] = React.useState(false);

  const directorShareholders = React.useMemo(() => {
    if (USE_MOCK_DIRECTOR_SHAREHOLDER_ROWS) {
      console.log("Director and Shareholders: using mock rows for UI preview");
      return MOCK_DIRECTOR_SHAREHOLDER_ROWS;
    }
    return extractDirectorShareholders(app.issuer_organization);
  }, [app.issuer_organization]);

  const subjectReportByRef = React.useMemo(() => {
    const m = new Map<string, { id: string; has_report_html: boolean; fetched_at: string }>();
    for (const r of ctosSubjectList ?? []) {
      const ref = r.subject_ref;
      if (ref) m.set(ref, { id: r.id, has_report_html: Boolean(r.has_report_html), fetched_at: r.fetched_at });
    }
    return m;
  }, [ctosSubjectList]);

  const ctosDirectorCrossRows = React.useMemo((): CtosDirectorShareholderCrossRow[] => {
    if (USE_MOCK_DIRECTOR_SHAREHOLDER_ROWS) {
      return MOCK_CTOS_DIRECTOR_CROSS_ROWS;
    }
    return directorShareholders.map((r) => {
      const snap = r.subjectRef ? subjectReportByRef.get(r.subjectRef) : undefined;
      const lastSubjectFetchLabel = snap?.fetched_at ? formatCtosListFetchedAt(snap.fetched_at) : null;
      return {
        id: `ctos-cross-${r.id}`,
        profileRowId: r.id,
        ctosDisplayName: null,
        ctosDisplayRole: null,
        ctosOwnership: null,
        nameCheck: "na",
        roleCheck: "na",
        ownershipCheck: "na",
        lastSubjectFetchLabel,
      };
    });
  }, [directorShareholders, subjectReportByRef]);

  const { questionnaire, unauditedByYear } = React.useMemo(
    () => extractQuestionnaireAndUnaudited(app.financial_statements),
    [app.financial_statements]
  );
  const hasIssuerFinancialData = Object.keys(unauditedByYear).length > 0;

  const latestCtos = ctosList?.[0];

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
      if (r.reporting_year != null) m.set(r.reporting_year, r);
    }
    return m;
  }, [financialRows]);

  const ctosLatestYear = React.useMemo(() => getCtosLatestYear(financialRows), [financialRows]);

  const ctosYears = React.useMemo(() => getLatestThreeCtosYears(financialRows), [financialRows]);

  const ctosReportingYearsSet = React.useMemo(() => {
    const s = new Set<number>();
    for (const r of financialRows) {
      if (r.reporting_year != null && Number.isFinite(r.reporting_year)) s.add(r.reporting_year);
    }
    return s;
  }, [financialRows]);

  const rawUnauditedYears = React.useMemo(
    () =>
      Object.keys(unauditedByYear)
        .map((k) => parseInt(k, 10))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b),
    [unauditedByYear]
  );

  const filteredUnauditedYears = React.useMemo(
    () => rawUnauditedYears.filter((y) => !ctosReportingYearsSet.has(y)),
    [rawUnauditedYears, ctosReportingYearsSet]
  );

  const columns = React.useMemo((): ColumnSpec[] => {
    const ctosSlots: (number | null)[] = [null, null, null];
    const offset = 3 - ctosYears.length;
    for (let i = 0; i < ctosYears.length; i++) {
      ctosSlots[offset + i] = ctosYears[i]!;
    }
    const u0 = filteredUnauditedYears[0] ?? null;
    const u1 = filteredUnauditedYears[1] ?? null;

    const ctosPart: ColumnSpec[] = ctosSlots.map((year) => ({
      kind: "ctos" as const,
      year,
    }));

    const unPart: ColumnSpec[] = [u0, u1].map((year) => ({
      kind: "unaudited" as const,
      year,
      validation:
        year != null && questionnaire
          ? validateUnauditedColumn({
              ctosLatestYear,
              unauditedYear: year,
              latestYearSubmitted: questionnaire.submitted_this_financial_year,
              financialYearEndYear: questionnaire.latest_financial_year,
            })
          : {
              status: "PENDING" as const,
              reason: year == null ? "No unaudited data" : "No questionnaire on file",
            },
    }));

    const finalCols = [...ctosPart, ...unPart];
    const validationResults = finalCols.map((c, columnIndex) => {
      if (c.kind === "unaudited") {
        return {
          columnIndex,
          kind: "unaudited" as const,
          year: c.year,
          displayStatus: adminColumnStatusLabel(c, ctosFetchState, ctosLatestYear, questionnaire),
          validation: c.validation,
        };
      }
      return {
        columnIndex,
        kind: "ctos" as const,
        year: c.year,
        displayStatus: adminColumnStatusLabel(c, ctosFetchState, ctosLatestYear, questionnaire),
      };
    });
    console.log("CTOS years:", ctosYears);
    console.log("CTOS state:", ctosFetchState);
    console.log("Unaudited years (raw):", rawUnauditedYears);
    console.log("Unaudited years (filtered):", filteredUnauditedYears);
    console.log("Latest CTOS year:", ctosLatestYear);
    console.log("Validation results:", validationResults);
    console.log("Final columns:", finalCols);
    return finalCols;
  }, [
    ctosYears,
    filteredUnauditedYears,
    questionnaire,
    ctosLatestYear,
    ctosFetchState,
    rawUnauditedYears,
  ]);

  const turnovers = React.useMemo(() => {
    return columns.map((spec) => {
      if (spec.year == null) return { year: null as number | null, turnover: null as number | null };
      if (spec.kind === "ctos") {
        const row = byYear.get(spec.year);
        return { year: spec.year, turnover: row?.profit_and_loss.revenue ?? null };
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

  const columnMetrics = React.useMemo((): (ColumnComputedMetrics | null)[] => {
    return columns.map((spec, idx) => {
      const g =
        idx === 0
          ? null
          : (() => {
              const t = turnovers[idx];
              const p = turnovers[idx - 1];
              if (t.year == null || p.year == null) return null;
              return computeTurnoverGrowth({
                targetYear: t.year,
                targetTurnover: t.turnover,
                priorYear: p.year,
                priorTurnover: p.turnover,
              });
            })();

      if (spec.kind === "ctos") {
        if (spec.year == null) return null;
        const row = byYear.get(spec.year);
        if (!row) return null;
        const { bs, pl } = financialFormToBsPl({
          bsfatot: row.balance_sheet.fixed_assets ?? 0,
          othass: row.balance_sheet.other_assets ?? 0,
          bscatot: row.balance_sheet.current_assets ?? 0,
          bsclbank: row.balance_sheet.non_current_assets ?? 0,
          curlib: row.balance_sheet.current_liabilities ?? 0,
          bsslltd: row.balance_sheet.long_term_liabilities ?? 0,
          bsclstd: row.balance_sheet.non_current_liabilities ?? 0,
          bsqpuc: row.balance_sheet.equity ?? 0,
          turnover: row.profit_and_loss.revenue ?? 0,
          plnpat: row.profit_and_loss.profit_after_tax ?? 0,
        });
        Object.assign(bs, {
          total_assets: row.balance_sheet.total_assets,
          total_liabilities: row.balance_sheet.total_liabilities,
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
  }, [columns, byYear, turnovers, hasIssuerFinancialData, unauditedByYear]);

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

  const onGetSubjectCtos = (row: DirectorShareholderRow) => {
    if (!row.subjectRef || !row.subjectKind) return;
    console.log("Fetching CTOS subject report:", row.subjectRef, row.subjectKind);
    const t = toast.loading("Fetching CTOS report…");
    createSubjectCtos.mutate(
      { subjectRef: row.subjectRef, subjectKind: row.subjectKind },
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
  };

  const rowLabels: { id: string; label: string }[] = [
    { id: "pldd", label: FINANCIAL_FIELD_LABELS.pldd },
    { id: "bsdd", label: FINANCIAL_FIELD_LABELS.bsdd },
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
        return formatCell(colIdx, true, !fs || fs.pldd == null || fs.pldd === "", () => String(fs!.pldd));
      case "bsdd":
        return formatCell(colIdx, true, !fs || fs.bsdd == null || fs.bsdd === "", () => String(fs!.bsdd));
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
        if (!computed) return "Cannot compute from available data";
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
        if (!computed) return "Cannot compute from available data";
        const n = computed.totlib;
        return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
      }
      case "networth": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (!computed) return "Cannot compute from available data";
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
        if (!computed || computed.turnover_growth == null) return "Cannot compute from available data";
        return formatNumber(computed.turnover_growth * 100, 2) + "%";
      }
      case "profit_margin": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (!computed || computed.profit_margin == null) return "Cannot compute from available data";
        return formatNumber(computed.profit_margin * 100, 2) + "%";
      }
      case "return_of_equity": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (!computed || computed.return_of_equity == null) return "Cannot compute from available data";
        return formatNumber(computed.return_of_equity * 100, 2) + "%";
      }
      case "currat": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (!computed || computed.currat == null) return "Cannot compute from available data";
        return formatNumber(computed.currat, 2);
      }
      case "workcap": {
        if (ctosColumnMissing(colIdx)) return "Missing in CTOS extract";
        if (!computed) return "Cannot compute from available data";
        return formatCurrency(computed.workcap, { decimals: 0 });
      }
      default:
        return "—";
    }
  };

  const fetchedLabel = latestCtos?.fetched_at
    ? new Date(latestCtos.fetched_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  const hadCtosUnauditedOverride = rawUnauditedYears.some((y) => ctosReportingYearsSet.has(y));

  const isMutedFinancialCell = (text: string) =>
    text === "—" ||
    text === "Missing in CTOS extract" ||
    text === "Field empty in CTOS" ||
    text === "Not provided in issuer form" ||
    text === "Cannot compute from available data";

  return (
    <>
      <ReviewFieldBlock title="Organization CTOS">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="m-0 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Fetch latest CTOS report</span> asks CTOS for a{" "}
                <span className="font-medium text-foreground">new</span> organization report.{" "}
                <span className="font-medium text-foreground">Financial Summary</span> and{" "}
                <span className="font-medium text-foreground">Director and Shareholders</span> show the organization data CTOS
                returns. <span className="font-medium text-foreground">View latest report</span> only opens the HTML from the{" "}
                <span className="font-medium text-foreground">last successful fetch</span>. It does not send a new request.
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
                  variant="secondary"
                  size="sm"
                  className="rounded-lg h-8 px-3 text-xs"
                  disabled={createCtos.isPending || ctosLoading}
                  onClick={() => setOrgCtosConfirmOpen(true)}
                >
                  {createCtos.isPending ? "Fetching…" : "Fetch latest CTOS report"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-8 px-3 text-xs"
                  disabled={!latestCtos?.has_report_html || ctosLoading}
                  onClick={() => void openFullReport()}
                >
                  View latest report
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ReviewFieldBlock>

      <ReviewFieldBlock title="Financial Summary">
        <p className="-mt-1 mb-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          CTOS reporting years compared with issuer unaudited columns.
        </p>
        <div className={applicationTableWrapperClass}>
          <TooltipProvider delayDuration={250}>
            <Collapsible open={financialSummaryLegendOpen} onOpenChange={setFinancialSummaryLegendOpen}>
              <div className="border-b border-border bg-muted/15">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                    "hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <InformationCircleIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="font-semibold text-foreground">Status meanings</span>
                    <span className="hidden truncate text-xs font-normal text-muted-foreground sm:inline">
                      Definitions for each status label in the Financial Summary table.
                    </span>
                  </span>
                  <ChevronDownIcon
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      financialSummaryLegendOpen && "rotate-180"
                    )}
                    aria-hidden
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border/80 bg-gradient-to-br from-muted/30 via-card to-muted/10 px-4 pb-3 pt-2">
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {FINANCIAL_SUMMARY_LEGEND_ORDER.map((item) => (
                      <div
                        key={item.term}
                        className="flex gap-2 rounded-md border border-border/80 bg-card/90 p-2 shadow-sm"
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-fit shrink-0 font-semibold text-[11px] leading-tight px-2 py-0.5 rounded-md shadow-none",
                            financialSummaryStatusToneClass(item.term)
                          )}
                        >
                          {item.term}
                        </Badge>
                        <p className="m-0 min-w-0 text-[11px] leading-relaxed text-muted-foreground">
                          {FINANCIAL_SUMMARY_STATUS_EXPLANATIONS[item.term] ?? item.term}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </div>
            </Collapsible>
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
                        financialSummaryColumnShellClass(spec.kind, i)
                      )}
                    >
                      <span className={spec.year != null ? "text-foreground" : "text-muted-foreground"}>
                        {spec.year != null ? String(spec.year) : HEADER_PLACEHOLDER}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead
                    className={cn(applicationTableHeaderClass, "border-r border-border bg-muted/30 align-middle")}
                  >
                    Type
                  </TableHead>
                  {columns.map((spec, i) => (
                    <TableHead
                      key={`typ-${i}-${spec.kind}`}
                      className={cn(
                        applicationTableHeaderClass,
                        "align-middle text-right tabular-nums",
                        i < columns.length - 1 ? "border-r border-border" : "",
                        financialSummaryColumnShellClass(spec.kind, i),
                        spec.kind === "unaudited" && "font-semibold text-foreground"
                      )}
                    >
                      {spec.kind === "ctos" ? "CTOS" : "Unaudited"}
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead
                    className={cn(applicationTableHeaderClass, "border-r border-border bg-muted/30 align-middle")}
                  >
                    Status
                  </TableHead>
                  {columns.map((spec, i) => {
                    const statusLabel = adminColumnStatusLabel(spec, ctosFetchState, ctosLatestYear, questionnaire);
                    return (
                      <TableHead
                        key={`st-${i}-${spec.kind}-${spec.year ?? "dash"}`}
                        className={cn(
                          applicationTableHeaderClass,
                          "align-middle text-right tabular-nums",
                          i < columns.length - 1 ? "border-r border-border" : "",
                          financialSummaryColumnShellClass(spec.kind, i)
                        )}
                      >
                        <div className="flex justify-end">
                          <FinancialSummaryStatusBadge statusLabel={statusLabel} />
                        </div>
                      </TableHead>
                    );
                  })}
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
                      {row.label}
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
                            financialSummaryColumnShellClass(spec.kind, ci),
                            !muted && "text-foreground"
                          )}
                        >
                          {muted ? (
                            cellText === "—" ? (
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
          </TooltipProvider>
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
        {USE_MOCK_DIRECTOR_SHAREHOLDER_ROWS ? (
          <p className="mb-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
            Preview only: issuer profile and CTOS cross-check rows are mock data. Set{" "}
            <span className="font-mono">USE_MOCK_DIRECTOR_SHAREHOLDER_ROWS</span> to <span className="font-mono">false</span>{" "}
            in application-financial-review-content.tsx to use real issuer rows (CTOS cross-check will still show empty
            until wired to API).
          </p>
        ) : null}
        <p
          className={cn(
            "mb-3 max-w-3xl text-xs leading-relaxed text-muted-foreground",
            !USE_MOCK_DIRECTOR_SHAREHOLDER_ROWS && "-mt-1"
          )}
        >
          The first table is issuer data from onboarding (ownership and KYC / KYB). CTOS does not provide KYC or KYB. The
          second table is for subject CTOS names and roles so you can cross-check them against the profile. Use{" "}
          <span className="font-medium text-foreground">Get report</span> on either table for the same person or entity.
          Organization CTOS and Financial Summary cover organization-level CTOS.
        </p>
        {directorShareholders.length > 0 ? (
          <div className="space-y-8">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Issuer profile (KYC / KYB)</h3>
              <div className={applicationTableWrapperClass}>
                <Table className="text-[15px]">
                  <TableHeader className={applicationTableHeaderBgClass}>
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className={applicationTableHeaderClass}>Name (issuer)</TableHead>
                      <TableHead className={applicationTableHeaderClass}>Role</TableHead>
                      <TableHead className={applicationTableHeaderClass}>Ownership</TableHead>
                      <TableHead className={applicationTableHeaderClass}>KYC / KYB</TableHead>
                      <TableHead className={applicationTableHeaderClass}>Last subject fetch</TableHead>
                      <TableHead className={applicationTableHeaderClass}>View report</TableHead>
                      <TableHead className={`${applicationTableHeaderClass} w-[140px]`}>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {directorShareholders.map((row) => {
                      const isApproved =
                        row.verificationStatus === "APPROVED" || row.verificationStatus === "Approved";
                      const subjectSnap = row.subjectRef ? subjectReportByRef.get(row.subjectRef) : undefined;
                      const canViewSubject = Boolean(subjectSnap?.has_report_html);
                      return (
                        <TableRow key={row.id} className={applicationTableRowClass}>
                          <TableCell className={`${applicationTableCellClass} font-medium`}>{row.name}</TableCell>
                          <TableCell className={applicationTableCellClass}>{row.role}</TableCell>
                          <TableCell className={applicationTableCellClass}>{row.ownership ?? "—"}</TableCell>
                          <TableCell className={applicationTableCellClass}>
                            {row.verificationStatus ? (
                              <Badge
                                variant="outline"
                                className={
                                  isApproved
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                                    : "border-amber-500/30 bg-amber-500/10 text-amber-700"
                                }
                              >
                                <CheckCircleIcon className="h-3 w-3 mr-1 inline" />
                                {row.verificationLabel}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className={applicationTableCellClass}>
                            {subjectLastFetchDisplay({
                              subjectRef: row.subjectRef,
                              snap: subjectSnap,
                            })}
                          </TableCell>
                          <TableCell className={applicationTableCellClass}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg h-8 text-xs"
                              disabled={
                                !row.subjectRef ||
                                !canViewSubject ||
                                ctosSubjectLoading ||
                                !subjectSnap?.id
                              }
                              onClick={() => void openSubjectHtmlReport(subjectSnap!.id)}
                            >
                              View report
                            </Button>
                          </TableCell>
                          <TableCell className={applicationTableCellClass}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg h-8 text-xs"
                              disabled={
                                !row.subjectRef ||
                                !row.subjectKind ||
                                createSubjectCtos.isPending ||
                                ctosSubjectLoading
                              }
                              onClick={() => onGetSubjectCtos(row)}
                            >
                              {createSubjectCtos.isPending ? "Fetching…" : "Get report"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">CTOS subject (cross-check)</h3>
              <p className="mb-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                Values here come from the subject CTOS report, not from KYC or KYB. Compare to{" "}
                <span className="font-medium text-foreground">Issuer profile (KYC / KYB)</span> above.
              </p>
              <p className="mb-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Internal logic (planned):</span>{" "}
                <span className="font-medium text-foreground">Name check</span> compares issuer name to CTOS name with
                normalized, order-insensitive tokens. <span className="font-medium text-foreground">Role check</span> compares
                director / shareholder / corporate capacity. <span className="font-medium text-foreground">Ownership check</span>{" "}
                runs only when both sides have a percent (same value = Match, rounding TBD).{" "}
                <span className="font-medium text-foreground">Needs review</span> = incomplete or fuzzy name.{" "}
                <span className="font-medium text-foreground">Mismatch</span> = clear conflict. A cell shows an em dash when
                that dimension is not applicable or not computed yet. Mock rows demonstrate outcomes; live data fills after
                CTOS parse.
              </p>
              <div className={applicationTableWrapperClass}>
                <Table className="text-[15px]">
                  <TableHeader className={applicationTableHeaderBgClass}>
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className={applicationTableHeaderClass}>Name (CTOS)</TableHead>
                      <TableHead className={applicationTableHeaderClass}>Role (CTOS)</TableHead>
                      <TableHead className={applicationTableHeaderClass}>Ownership (CTOS)</TableHead>
                      <TableHead className={applicationTableHeaderClass}>Name check</TableHead>
                      <TableHead className={applicationTableHeaderClass}>Role check</TableHead>
                      <TableHead className={applicationTableHeaderClass}>Ownership check</TableHead>
                      <TableHead className={applicationTableHeaderClass}>Last subject fetch</TableHead>
                      <TableHead className={applicationTableHeaderClass}>View report</TableHead>
                      <TableHead className={`${applicationTableHeaderClass} w-[140px]`}>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ctosDirectorCrossRows.map((cross) => {
                      const profileRow = directorShareholders.find((r) => r.id === cross.profileRowId);
                      const subjectSnap =
                        profileRow?.subjectRef != null
                          ? subjectReportByRef.get(profileRow.subjectRef)
                          : undefined;
                      const canViewSubject = Boolean(subjectSnap?.has_report_html);
                      return (
                        <TableRow key={cross.id} className={applicationTableRowClass}>
                          <TableCell className={`${applicationTableCellClass} font-medium`}>
                            {cross.ctosDisplayName ?? "—"}
                          </TableCell>
                          <TableCell className={applicationTableCellClass}>
                            {cross.ctosDisplayRole ?? "—"}
                          </TableCell>
                          <TableCell className={applicationTableCellClass}>
                            {cross.ctosOwnership ?? "—"}
                          </TableCell>
                          <TableCell className={applicationTableCellClass}>
                            {dimensionCheckDisplay(cross.nameCheck)}
                          </TableCell>
                          <TableCell className={applicationTableCellClass}>
                            {dimensionCheckDisplay(cross.roleCheck)}
                          </TableCell>
                          <TableCell className={applicationTableCellClass}>
                            {dimensionCheckDisplay(cross.ownershipCheck)}
                          </TableCell>
                          <TableCell className={applicationTableCellClass}>
                            {USE_MOCK_DIRECTOR_SHAREHOLDER_ROWS ? (
                              cross.lastSubjectFetchLabel ? (
                                <span className="tabular-nums text-muted-foreground">{cross.lastSubjectFetchLabel}</span>
                              ) : (
                                <span className="text-muted-foreground">{HEADER_PLACEHOLDER}</span>
                              )
                            ) : (
                              subjectLastFetchDisplay({
                                subjectRef: profileRow?.subjectRef ?? null,
                                snap: subjectSnap,
                              })
                            )}
                          </TableCell>
                          <TableCell className={applicationTableCellClass}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg h-8 text-xs"
                              disabled={
                                !profileRow?.subjectRef ||
                                !canViewSubject ||
                                ctosSubjectLoading ||
                                !subjectSnap?.id
                              }
                              onClick={() => void openSubjectHtmlReport(subjectSnap!.id)}
                            >
                              View report
                            </Button>
                          </TableCell>
                          <TableCell className={applicationTableCellClass}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg h-8 text-xs"
                              disabled={
                                !profileRow?.subjectRef ||
                                !profileRow.subjectKind ||
                                createSubjectCtos.isPending ||
                                ctosSubjectLoading
                              }
                              onClick={() => profileRow && onGetSubjectCtos(profileRow)}
                            >
                              {createSubjectCtos.isPending ? "Fetching…" : "Get report"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card min-h-[80px] flex items-center justify-center">
            <p className={`${reviewEmptyStateClass} py-6`}>
              No director or shareholder data available. Data is sourced from organization profile.
            </p>
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
            <AlertDialogTitle>Request a new report from CTOS?</AlertDialogTitle>
            <AlertDialogDescription>
              This starts a new CTOS pull for this organization. Financial Summary and Director and Shareholders on this page
              use organization data from CTOS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" disabled={createCtos.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "secondary" }), "rounded-lg")}
              disabled={createCtos.isPending}
              onClick={() => {
                onGetCtos();
              }}
            >
              Fetch latest CTOS report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
