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
import { CheckCircleIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { formatCurrency, formatNumber, useAuthToken } from "@cashsouk/config";
import {
  FINANCIAL_FIELD_LABELS,
  computeColumnMetrics,
  computeTurnoverGrowth,
  financialFormToBsPl,
  getAdminFinancialSummaryUserColumnYears,
  getLatestThreeCtosYearSlots,
  governmentIdFromDirectorKycForEod,
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Year row placeholder when no year (em dash). */
const HEADER_PLACEHOLDER = "\u2014";

type CtosFetchState = "not_pulled" | "no_records" | "has_data";

/** Show financial dates with slashes (d/M/yyyy) for CTOS and user columns. */
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

/** TEMP: set to false to use real issuer organization data. Remove when CTOS cross-check table is done. */
/** Temporary: mock issuer + CTOS director rows on the Financial tab. Set back to `false` when done. */
const USE_MOCK_DIRECTOR_SHAREHOLDER_ROWS = true;

/**
 * Mock issuer rows: order matches cross-check walk. Covers MATCH, each MISMATCH shape, NOT FOUND (no IC / missing in
 * CTOS), and duplicate-key CTOS (second row → EXTRA IN CTOS).
 */
const MOCK_DIRECTOR_SHAREHOLDER_ROWS: DirectorShareholderRow[] = [
  {
    id: "mock-ds-match-ind",
    name: "Ideal Match Person",
    role: "Director",
    ownership: "12% ownership",
    icOrSsm: "101010101010",
    verificationLabel: "KYC",
    verificationStatus: "APPROVED",
    subjectRef: null,
    subjectKind: "INDIVIDUAL",
  },
  {
    id: "mock-ds-match-corp",
    name: "Ideal Corp Sdn Bhd",
    role: "Corporate Shareholder",
    ownership: "8% ownership",
    icOrSsm: "202020202020",
    verificationLabel: "KYB",
    verificationStatus: "APPROVED",
    subjectRef: null,
    subjectKind: "CORPORATE",
  },
  {
    id: "mock-ds-mm-name",
    name: "Correct Spelling Name",
    role: "Director",
    ownership: null,
    icOrSsm: "303030303030",
    verificationLabel: "KYC",
    verificationStatus: "APPROVED",
    subjectRef: null,
    subjectKind: "INDIVIDUAL",
  },
  {
    id: "mock-ds-mm-role",
    name: "Same Name Four",
    role: "Director",
    ownership: null,
    icOrSsm: "404040404040",
    verificationLabel: "KYC",
    verificationStatus: "APPROVED",
    subjectRef: null,
    subjectKind: "INDIVIDUAL",
  },
  {
    id: "mock-ds-mm-own",
    name: "Same Name Five",
    role: "Director",
    ownership: "10% ownership",
    icOrSsm: "505050505050",
    verificationLabel: "KYC",
    verificationStatus: "APPROVED",
    subjectRef: null,
    subjectKind: "INDIVIDUAL",
  },
  {
    id: "mock-ds-mm-multi",
    name: "Many Issues Person",
    role: "Director, Shareholder",
    ownership: "50% ownership",
    icOrSsm: "606060606060",
    verificationLabel: "KYC",
    verificationStatus: "APPROVED",
    subjectRef: null,
    subjectKind: "INDIVIDUAL",
  },
  {
    id: "mock-ds-not-in-ctos",
    name: "Nobody In Ctos List",
    role: "Director",
    ownership: null,
    icOrSsm: "707070707070",
    verificationLabel: "KYC",
    verificationStatus: "APPROVED",
    subjectRef: null,
    subjectKind: "INDIVIDUAL",
  },
  {
    id: "mock-ds-no-ic",
    name: "Missing Id On Issuer",
    role: "Shareholder",
    ownership: "5% ownership",
    icOrSsm: null,
    verificationLabel: "KYC",
    verificationStatus: "PENDING_REVIEW",
    subjectRef: null,
    subjectKind: "INDIVIDUAL",
  },
  {
    id: "mock-ds-dup-first",
    name: "First Duplicate",
    role: "Director",
    ownership: null,
    icOrSsm: "808080808080",
    verificationLabel: "KYC",
    verificationStatus: "APPROVED",
    subjectRef: null,
    subjectKind: "INDIVIDUAL",
  },
];

/**
 * SECTION: CTOS organization director shape (company_json.directors)
 * WHY: Typed slice of parser output for IC/SSM-keyed cross-check
 * INPUT: XML-derived JSON
 * OUTPUT: normalized in-memory row
 * WHERE USED: buildDirectorCtosComparison, extractCtosOrgDirectorsFromCompanyJson
 */
interface CtosOrgDirectorRow {
  ic_lcno: string | null;
  nic_brno: string | null;
  name: string | null;
  position: string | null;
  equity_percentage: number | null;
  equity: number | null;
  /** ENQWS: I = individual, C = corporate (SSM-style id often in ic_lcno). */
  party_type: string | null;
}

type DirectorCtosRowStatus =
  | "MATCH"
  | "MISMATCH"
  | "NOT VERIFIABLE"
  | "NOT FOUND IN CTOS"
  | "EXTRA IN CTOS";

/**
 * SECTION: DirectorCtosComparisonTableRow
 * WHY: One admin table row for issuer vs organization CTOS
 * INPUT: built by buildDirectorCtosComparison
 * OUTPUT: cells for Name/Role/Ownership checks and row status
 * WHERE USED: CTOS cross-check table
 */
interface DirectorCtosComparisonTableRow {
  id: string;
  /** Onboarding row id when IC matched (name/role checks only); never used for Get report. */
  profileRowId: string | null;
  issuerName: string;
  ctosName: string;
  nameCheckCell: string;
  roleCheckCell: string;
  ownershipCheckCell: string;
  rowStatus: DirectorCtosRowStatus;
  /** Built only from CTOS org director row; drives subject Get report / View report. */
  subjectActionRow: DirectorShareholderRow | null;
}

/**
 * SECTION: Mock CTOS organization director rows (KYB/KYC cross-check dev preview)
 * WHY: Same shape as parsed company_json.directors when organization CTOS is not loaded
 * INPUT: none
 * OUTPUT: list with IC/SSM and display fields
 * WHERE USED: USE_MOCK_DIRECTOR_SHAREHOLDER_ROWS comparison only
 */
/**
 * Mock CTOS org directors: paired ICs align with issuer mocks. Two rows share 808080808080 (second → EXTRA IN CTOS).
 * One row has no nic/ic → NOT VERIFIABLE. One IC only on CTOS → EXTRA IN CTOS.
 */
const MOCK_CTOS_ORG_DIRECTOR_ROWS: CtosOrgDirectorRow[] = [
  {
    ic_lcno: null,
    nic_brno: "101010101010",
    name: "IDEAL MATCH PERSON",
    position: "Director",
    equity_percentage: 12,
    equity: null,
    party_type: "I",
  },
  {
    ic_lcno: "202020202020",
    nic_brno: null,
    name: "IDEAL CORP SDN BHD",
    position: "Corporate Shareholder",
    equity_percentage: 8,
    equity: null,
    party_type: "C",
  },
  {
    ic_lcno: null,
    nic_brno: "303030303030",
    name: "WRONG SPELLING ON CTOS",
    position: "Director",
    equity_percentage: null,
    equity: null,
    party_type: "I",
  },
  {
    ic_lcno: null,
    nic_brno: "404040404040",
    name: "SAME NAME FOUR",
    position: "Shareholder",
    equity_percentage: null,
    equity: null,
    party_type: "I",
  },
  {
    ic_lcno: null,
    nic_brno: "505050505050",
    name: "SAME NAME FIVE",
    position: "Director",
    equity_percentage: 25,
    equity: null,
    party_type: "I",
  },
  {
    ic_lcno: null,
    nic_brno: "606060606060",
    name: "MANY ISSUES PERSON",
    position: "Director",
    equity_percentage: 5,
    equity: null,
    party_type: "I",
  },
  {
    ic_lcno: null,
    nic_brno: "808080808080",
    name: "FIRST DUPLICATE",
    position: "Director",
    equity_percentage: null,
    equity: null,
    party_type: "I",
  },
  {
    ic_lcno: null,
    nic_brno: "808080808080",
    name: "SECOND DUPLICATE EXTRA",
    position: "Director",
    equity_percentage: null,
    equity: null,
    party_type: "I",
  },
  {
    ic_lcno: null,
    nic_brno: "909090909090",
    name: "EXTRA ONLY ON CTOS",
    position: "Director",
    equity_percentage: null,
    equity: null,
    party_type: "I",
  },
  {
    ic_lcno: null,
    nic_brno: null,
    name: "NO ID IN CTOS ROW",
    position: "Director",
    equity_percentage: null,
    equity: null,
    party_type: "I",
  },
];

/**
 * SECTION: Normalize IC / SSM for map keys
 * WHY: Stable equality without guessing identity from names
 * INPUT: raw id string
 * OUTPUT: trimmed lowercase no spaces, or null if empty
 * WHERE USED: buildDirectorCtosComparison
 */
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

/**
 * SECTION: Merge issuer rows by IC/SSM for CTOS compare (Option A)
 * WHY: corporate_entities can list same person twice (Director + Shareholder); CTOS usually has one row (e.g. DS)
 * INPUT: DirectorShareholderRow[]
 * OUTPUT: one row per normalized icOrSsm + subjectKind when mergeable
 * WHERE USED: directorCtosComparisonTableRows after issuer-flow or raw extract list
 */
function mergeDirectorShareholderGroup(group: DirectorShareholderRow[]): DirectorShareholderRow {
  const hasDir = group.some((r) => r.role === "Director");
  const hasSh = group.some((r) => r.role === "Shareholder");
  const allCorp = group.every((r) => r.role === "Corporate Shareholder");

  let mergedRole: string;
  if (allCorp) {
    mergedRole = "Corporate Shareholder";
  } else if (hasDir && hasSh) {
    mergedRole = "Director, Shareholder";
  } else if (hasDir) {
    mergedRole = "Director";
  } else if (hasSh) {
    mergedRole = "Shareholder";
  } else {
    mergedRole = group[0].role;
  }

  const ownership =
    group.find((r) => r.ownership != null && String(r.ownership).trim() !== "")?.ownership ?? null;

  const namePick =
    [...group].sort((a, b) => b.name.trim().length - a.name.trim().length)[0]?.name ?? group[0].name;

  const primary =
    group.find(
      (r) => r.role === "Shareholder" && r.ownership != null && String(r.ownership).trim() !== ""
    ) ??
    group.find((r) => r.role === "Director") ??
    group[0];

  return {
    ...primary,
    name: namePick.trim() || primary.name,
    role: mergedRole,
    ownership,
  };
}

function mergeDirectorShareholderRowsForCtosCompare(rows: DirectorShareholderRow[]): DirectorShareholderRow[] {
  const noKey: DirectorShareholderRow[] = [];
  const bucketOrder: string[] = [];
  const buckets = new Map<string, DirectorShareholderRow[]>();

  for (const r of rows) {
    const k = normalizeIcSsmKey(r.icOrSsm);
    if (!k) {
      noKey.push(r);
      continue;
    }
    const kind = r.subjectKind ?? "UNKNOWN";
    const bucketKey = `${k}|${kind}`;
    if (!buckets.has(bucketKey)) {
      bucketOrder.push(bucketKey);
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey)!.push(r);
  }

  const merged: DirectorShareholderRow[] = [...noKey];
  for (const key of bucketOrder) {
    const group = buckets.get(key)!;
    if (group.length === 1) {
      merged.push(group[0]);
    } else {
      merged.push(mergeDirectorShareholderGroup(group));
    }
  }
  return merged;
}

/**
 * SECTION: Primary CTOS id from director row (IC or SSM)
 * WHY: Parser stores individuals under nic_brno and companies under ic_lcno
 * INPUT: CtosOrgDirectorRow
 * OUTPUT: first non-empty id string
 * WHERE USED: CTOS map and NOT VERIFIABLE gate
 */
function primaryCtosIdFromDirectorRow(r: CtosOrgDirectorRow): string {
  const a = r.nic_brno != null ? String(r.nic_brno).trim() : "";
  const b = r.ic_lcno != null ? String(r.ic_lcno).trim() : "";
  return a || b;
}

/**
 * SECTION: Ownership string from CTOS director equity fields
 * WHY: Compare to issuer "% ownership" strings
 * INPUT: CtosOrgDirectorRow
 * OUTPUT: e.g. "40% ownership" or null
 * WHERE USED: matched-pair ownership check
 */
function ownershipFromCtosDirector(r: CtosOrgDirectorRow): string | null {
  if (r.equity_percentage != null && !Number.isNaN(Number(r.equity_percentage))) {
    return `${r.equity_percentage}% ownership`;
  }
  if (r.equity != null && !Number.isNaN(Number(r.equity))) {
    return `${r.equity}% ownership`;
  }
  return null;
}

/**
 * SECTION: CTOS director/shareholder position codes (ENQWS company_json.directors.position)
 * WHY: CTOS returns DO/SO/DS/AD/AS; Role check compares issuer role to that field (codes + common phrases)
 * INPUT: code or free-text from XML / issuer form
 * OUTPUT: canonical codes and boolean match for role check
 * WHERE USED: buildDirectorCtosComparison (Role check only; no extra table column)
 */
const CTOS_POSITION_LABEL_BY_CODE: Record<string, string> = {
  DO: "Director Only",
  SO: "Shareholder Only",
  DS: "Director & Shareholder",
  AD: "Alternate Director",
  AS: "Alternate Director & Shareholder",
};

function ctosPositionCanonicalCode(position: string | null | undefined): string | null {
  const p = String(position ?? "").trim().toUpperCase();
  if (p in CTOS_POSITION_LABEL_BY_CODE) return p;
  return null;
}

function collapseRoleSpaces(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Map issuer or legacy free-text to CTOS position code when recognizable */
function issuerRoleCanonicalCode(role: string | null | undefined): string | null {
  const raw = String(role ?? "").trim();
  if (!raw) return null;
  const asCode = ctosPositionCanonicalCode(raw);
  if (asCode) return asCode;
  const n = collapseRoleSpaces(raw.replace(/&/g, " and ").replace(/\+/g, " and "));
  const checks: { re: RegExp; code: string }[] = [
    { re: /\balternate\s+director\s+and\s+shareholder\b/, code: "AS" },
    { re: /\balternate\s+director\b/, code: "AD" },
    { re: /\bdirector\s*,\s*shareholder\b/, code: "DS" },
    { re: /\bdirector\s+and\s+shareholder\b/, code: "DS" },
    { re: /\bdirector\s+only\b/, code: "DO" },
    { re: /\bshareholder\s+only\b/, code: "SO" },
    { re: /\bcorporate\s+shareholder\b/, code: "SO" },
    { re: /\bshareholder\b/, code: "SO" },
    { re: /\bdirector\b/, code: "DO" },
  ];
  for (const { re, code } of checks) {
    if (re.test(n)) return code;
  }
  return null;
}

function ctosDirectorRolesMatch(issuerRole: string, ctosPosition: string | null | undefined): boolean {
  const i = String(issuerRole ?? "").trim();
  const cRaw = String(ctosPosition ?? "").trim();
  if (!i && !cRaw) return true;
  const iCode = issuerRoleCanonicalCode(i);
  const cCode = ctosPositionCanonicalCode(cRaw);

  if (iCode && cCode) return iCode === cCode;
  if (iCode && !cCode && cRaw) {
    return i.toLowerCase() === cRaw.toLowerCase();
  }
  if (!iCode && cCode && i) {
    const label = CTOS_POSITION_LABEL_BY_CODE[cCode];
    return (
      i.toLowerCase() === cRaw.toLowerCase() ||
      i.toLowerCase() === label.toLowerCase() ||
      i.toLowerCase() === cCode.toLowerCase()
    );
  }
  return i.toLowerCase() === cRaw.toLowerCase();
}

/**
 * SECTION: Parse company_json.directors from organization CTOS list item
 * WHY: Admin list now includes company_json for cross-check
 * INPUT: unknown JSON
 * OUTPUT: CtosOrgDirectorRow[]
 * WHERE USED: ApplicationFinancialReviewContent useMemo
 */
function extractCtosOrgDirectorsFromCompanyJson(companyJson: unknown): CtosOrgDirectorRow[] {
  const cj = companyJson as { directors?: unknown } | null | undefined;
  const raw = Array.isArray(cj?.directors) ? cj!.directors : [];
  const out: CtosOrgDirectorRow[] = [];
  for (const d of raw) {
    const x = d as Record<string, unknown>;
    const ptRaw = x.party_type != null ? String(x.party_type).trim() : "";
    out.push({
      ic_lcno: x.ic_lcno != null ? String(x.ic_lcno) : null,
      nic_brno: x.nic_brno != null ? String(x.nic_brno) : null,
      name: x.name != null ? String(x.name) : null,
      position: x.position != null ? String(x.position) : null,
      equity_percentage: typeof x.equity_percentage === "number" ? x.equity_percentage : null,
      equity: typeof x.equity === "number" ? x.equity : null,
      party_type: ptRaw !== "" ? ptRaw : null,
    });
  }
  return out;
}

/**
 * SECTION: Subject kind from CTOS org director row
 * WHY: buildCtosSubjectEnquiryXml needs INDIVIDUAL (nic_br) vs CORPORATE (ic_lc)
 * INPUT: company_json.directors[] element
 * OUTPUT: INDIVIDUAL | CORPORATE | null
 * WHERE USED: directorShareholderRowFromCtosOrgDirectorForAction
 */
function directorSubjectKindFromCtosOrgRow(r: CtosOrgDirectorRow): "INDIVIDUAL" | "CORPORATE" | null {
  if (r.party_type === "I") return "INDIVIDUAL";
  if (r.party_type === "C") return "CORPORATE";
  const nic = (r.nic_brno ?? "").trim();
  const ic = (r.ic_lcno ?? "").trim();
  if (nic && !ic) return "INDIVIDUAL";
  if (ic && !nic) return "CORPORATE";
  if (nic) return "INDIVIDUAL";
  if (ic) return "CORPORATE";
  return null;
}

function roleLabelFromCtosOrgDirector(r: CtosOrgDirectorRow): string {
  const c = ctosPositionCanonicalCode(r.position);
  if (c && CTOS_POSITION_LABEL_BY_CODE[c]) return CTOS_POSITION_LABEL_BY_CODE[c];
  const p = (r.position ?? "").trim();
  return p || "Director";
}

/**
 * SECTION: Synthetic issuer-shaped row from CTOS only (subject fetch)
 * WHY: CTOS table Get report must use org-report id + name, not corporate_entities
 * INPUT: CtosOrgDirectorRow; stable synthetic id
 * OUTPUT: DirectorShareholderRow for API or null if id/kind missing
 * WHERE USED: buildDirectorCtosComparison subjectActionRow
 */
function directorShareholderRowFromCtosOrgDirectorForAction(
  ctosRow: CtosOrgDirectorRow,
  syntheticId: string
): DirectorShareholderRow | null {
  const icOrSsm = primaryCtosIdFromDirectorRow(ctosRow).trim();
  if (!icOrSsm) return null;
  const subjectKind = directorSubjectKindFromCtosOrgRow(ctosRow);
  if (!subjectKind) return null;
  return {
    id: syntheticId,
    name: (ctosRow.name ?? "").trim() || "Unknown",
    role: roleLabelFromCtosOrgDirector(ctosRow),
    ownership: ownershipFromCtosDirector(ctosRow),
    icOrSsm,
    verificationLabel: subjectKind === "CORPORATE" ? "KYB" : "KYC",
    verificationStatus: null,
    subjectRef: null,
    subjectKind,
  };
}

/**
 * SECTION: Build CTOS-first director cross-check rows
 * WHY: Table order follows company_json.directors only; onboarding used only for IC-keyed name/role/ownership checks; subject actions use CTOS ids only
 * INPUT: issuer list (merge), CTOS org director list
 * OUTPUT: table rows + debug side lists
 * WHERE USED: ApplicationFinancialReviewContent
 */
function buildDirectorCtosComparison(
  issuerList: DirectorShareholderRow[],
  ctosList: CtosOrgDirectorRow[]
): {
  tableRows: DirectorCtosComparisonTableRow[];
  matchedPairs: { issuerId: string; ctosName: string | null }[];
  unmatchedIssuer: DirectorShareholderRow[];
  unmatchedCtos: CtosOrgDirectorRow[];
} {
  const issuerByKey = new Map<string, DirectorShareholderRow[]>();
  for (const ir of issuerList) {
    const k = normalizeIcSsmKey(ir.icOrSsm);
    if (!k) continue;
    const arr = issuerByKey.get(k) ?? [];
    arr.push(ir);
    issuerByKey.set(k, arr);
  }
  const usedIssuerId = new Set<string>();

  const ctosKeys = new Set<string>();
  for (const cr of ctosList) {
    const pk = normalizeIcSsmKey(primaryCtosIdFromDirectorRow(cr));
    if (pk) ctosKeys.add(pk);
  }

  const unmatchedIssuer: DirectorShareholderRow[] = [];
  for (const ir of issuerList) {
    const ik = normalizeIcSsmKey(ir.icOrSsm);
    if (!ik) {
      unmatchedIssuer.push(ir);
      continue;
    }
    if (!ctosKeys.has(ik)) unmatchedIssuer.push(ir);
  }

  const matchedPairs: { issuerId: string; ctosName: string | null }[] = [];
  const unmatchedCtos: CtosOrgDirectorRow[] = [];
  const tableRows: DirectorCtosComparisonTableRow[] = [];
  let rowSeq = 0;

  for (const ctosRow of ctosList) {
    const primary = primaryCtosIdFromDirectorRow(ctosRow);
    const key = normalizeIcSsmKey(primary);
    const rowId = `dcmp-${rowSeq++}`;
    const subjectActionRow = directorShareholderRowFromCtosOrgDirectorForAction(ctosRow, `${rowId}-ctos-subj`);

    if (!key) {
      unmatchedCtos.push(ctosRow);
      tableRows.push({
        id: rowId,
        profileRowId: null,
        issuerName: HEADER_PLACEHOLDER,
        ctosName: ctosRow.name ?? HEADER_PLACEHOLDER,
        nameCheckCell: HEADER_PLACEHOLDER,
        roleCheckCell: HEADER_PLACEHOLDER,
        ownershipCheckCell: HEADER_PLACEHOLDER,
        rowStatus: "NOT VERIFIABLE",
        subjectActionRow: null,
      });
      continue;
    }

    const bucket = issuerByKey.get(key) ?? [];
    const issuerMatch = bucket.find((r) => !usedIssuerId.has(r.id)) ?? null;
    if (issuerMatch) usedIssuerId.add(issuerMatch.id);

    const ctosNameStr = ctosRow.name ?? "";
    const ctosOwnStr = ownershipFromCtosDirector(ctosRow);

    if (!issuerMatch) {
      unmatchedCtos.push(ctosRow);
      tableRows.push({
        id: rowId,
        profileRowId: null,
        issuerName: HEADER_PLACEHOLDER,
        ctosName: ctosNameStr || HEADER_PLACEHOLDER,
        nameCheckCell: HEADER_PLACEHOLDER,
        roleCheckCell: HEADER_PLACEHOLDER,
        ownershipCheckCell: HEADER_PLACEHOLDER,
        rowStatus: "EXTRA IN CTOS",
        subjectActionRow,
      });
      continue;
    }

    const nameMatch =
      issuerMatch.name.trim().toLowerCase() === ctosNameStr.trim().toLowerCase();
    const roleMatch = ctosDirectorRolesMatch(issuerMatch.role, ctosRow.position);
    const ownA = (issuerMatch.ownership ?? "").trim().toLowerCase();
    const ownB = (ctosOwnStr ?? "").trim().toLowerCase();
    const ownershipMatch = ownA === ownB;

    const nameCheckCell: "MATCH" | "MISMATCH" = nameMatch ? "MATCH" : "MISMATCH";
    const roleCheckCell: "MATCH" | "MISMATCH" = roleMatch ? "MATCH" : "MISMATCH";
    const ownershipCheckCell: "MATCH" | "MISMATCH" = ownershipMatch ? "MATCH" : "MISMATCH";

    const allMatch = nameMatch && roleMatch && ownershipMatch;
    const rowStatus: "MATCH" | "MISMATCH" = allMatch ? "MATCH" : "MISMATCH";

    matchedPairs.push({ issuerId: issuerMatch.id, ctosName: ctosRow.name });
    tableRows.push({
      id: rowId,
      profileRowId: issuerMatch.id,
      issuerName: issuerMatch.name,
      ctosName: ctosNameStr || HEADER_PLACEHOLDER,
      nameCheckCell,
      roleCheckCell,
      ownershipCheckCell,
      rowStatus,
      subjectActionRow,
    });
  }

  return { tableRows, matchedPairs, unmatchedIssuer, unmatchedCtos };
}

/**
 * SECTION: Field check cell (Name / Role / Ownership)
 * WHY: MATCH and MISMATCH badges; em dash when not compared
 * INPUT: cell text
 * OUTPUT: React node
 * WHERE USED: CTOS cross-check table body
 */
function directorCtosFieldCheckDisplay(cell: string): React.ReactNode {
  if (cell === HEADER_PLACEHOLDER) {
    return <span className="text-muted-foreground">{HEADER_PLACEHOLDER}</span>;
  }
  if (cell === "MATCH") {
    return (
      <Badge
        variant="outline"
        className="font-semibold text-[11px] leading-tight border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100"
      >
        MATCH
      </Badge>
    );
  }
  if (cell === "MISMATCH") {
    return (
      <Badge
        variant="outline"
        className="font-semibold text-[11px] leading-tight border-destructive/40 bg-destructive/10 text-destructive"
      >
        MISMATCH
      </Badge>
    );
  }
  return <span className="text-muted-foreground">{cell}</span>;
}

/**
 * SECTION: Row status badge for cross-check
 * WHY: Capitalized statuses per compliance copy
 * INPUT: DirectorCtosRowStatus
 * OUTPUT: styled Badge
 * WHERE USED: Status column
 */
function directorCtosRowStatusBadgeClass(status: DirectorCtosRowStatus): string {
  if (status === "MATCH") {
    return "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100";
  }
  if (status === "MISMATCH") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  if (status === "NOT VERIFIABLE") {
    return "border-border bg-muted/50 text-muted-foreground";
  }
  if (status === "NOT FOUND IN CTOS") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100";
  }
  return "border-sky-500/35 bg-sky-500/10 text-sky-950 dark:text-sky-100";
}

function directorCtosRowStatusDisplay(status: DirectorCtosRowStatus): React.ReactNode {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold text-[11px] leading-tight shadow-none",
        directorCtosRowStatusBadgeClass(status)
      )}
    >
      {status}
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
    const primary = String(d.eodRequestId ?? "").trim();
    const shareholderEod = String(d.shareholderEodRequestId ?? "").trim();
    if ((primary === eod || shareholderEod === eod) && d.kycStatus) return String(d.kycStatus);
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

function issuerIcOrSsmFromCorpPerson(p: Record<string, unknown>): string | null {
  const info = p.personalInfo as Record<string, unknown> | undefined;
  const fromTop = String(info?.governmentIdNumber ?? "").trim();
  if (fromTop) return fromTop;
  const formContent = (info?.formContent ?? p.formContent) as Record<string, unknown> | undefined;
  const content = Array.isArray(formContent?.content)
    ? (formContent.content as Array<{ fieldName?: string; fieldValue?: string }>)
    : [];
  const idField = content.find((f) => f.fieldName === "Government ID Number");
  if (idField?.fieldValue) return String(idField.fieldValue).trim();
  return null;
}

function issuerIcOrSsmForCePersonRow(
  p: Record<string, unknown>,
  directorKycStatus: Record<string, unknown> | null | undefined
): string | null {
  const fromCe = issuerIcOrSsmFromCorpPerson(p);
  if (fromCe) return fromCe;
  const eod = String(p.eodRequestId ?? "").trim();
  return governmentIdFromDirectorKycForEod(directorKycStatus, eod);
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

  const getCorpBusinessNumber = (corp: Record<string, unknown>): string | null => {
    const formContent = corp.formContent as Record<string, unknown> | undefined;
    const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
    for (const area of displayAreas) {
      const content = Array.isArray((area as Record<string, unknown>)?.content)
        ? ((area as Record<string, unknown>).content as Array<{ fieldName?: string; fieldValue?: string }>)
        : [];
      const numField = content.find((f) => f.fieldName === "Business Number");
      if (numField?.fieldValue) return String(numField.fieldValue).trim();
    }
    return null;
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
      icOrSsm: issuerIcOrSsmForCePersonRow(p, directorKycStatus),
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
      icOrSsm: issuerIcOrSsmForCePersonRow(p, directorKycStatus),
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
      icOrSsm: getCorpBusinessNumber(corp),
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

  const getCorpBusinessNumber = (corp: Record<string, unknown>): string | null => {
    const formContent = corp.formContent as Record<string, unknown> | undefined;
    const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
    for (const area of displayAreas) {
      const content = Array.isArray((area as Record<string, unknown>)?.content)
        ? ((area as Record<string, unknown>).content as Array<{ fieldName?: string; fieldValue?: string }>)
        : [];
      const numField = content.find((f) => f.fieldName === "Business Number");
      if (numField?.fieldValue) return String(numField.fieldValue).trim();
    }
    return null;
  };

  for (const d of kycDirectors) {
    const ref = String(d.eodRequestId ?? "").trim();
    const roleStr = d.role ? String(d.role) : "";
    const gid = d.governmentIdNumber != null ? String(d.governmentIdNumber).trim() : "";
    rows.push({
      id: ref || `kyc-d-${idx++}`,
      name: String(d.name || "Unknown"),
      role: getRoleLabel(roleStr, false),
      ownership: extractOwnershipFromRole(roleStr),
      icOrSsm: gid || null,
      verificationLabel: "KYC",
      verificationStatus: d.kycStatus ? String(d.kycStatus) : null,
      subjectRef: ref || null,
      subjectKind: ref ? "INDIVIDUAL" : null,
    });
  }
  for (const s of kycShareholders) {
    const ref = String(s.eodRequestId ?? "").trim();
    const roleStr = s.role ? String(s.role) : "";
    const gid = s.governmentIdNumber != null ? String(s.governmentIdNumber).trim() : "";
    rows.push({
      id: ref || `kyc-s-${idx++}`,
      name: String(s.name || "Unknown"),
      role: getRoleLabel(roleStr, false),
      ownership: extractOwnershipFromRole(roleStr),
      icOrSsm: gid || null,
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
      icOrSsm: getCorpBusinessNumber(corp),
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
  const [directorCtosChecksExpanded, setDirectorCtosChecksExpanded] = React.useState<Record<string, boolean>>({});
  const [orgCtosConfirmOpen, setOrgCtosConfirmOpen] = React.useState(false);

  const directorShareholders = React.useMemo(() => {
    if (USE_MOCK_DIRECTOR_SHAREHOLDER_ROWS) {
      return MOCK_DIRECTOR_SHAREHOLDER_ROWS;
    }
    return extractDirectorShareholders(app.issuer_organization);
  }, [app.issuer_organization]);

  /**
   * SECTION: Merged issuer director/shareholder rows
   * WHY: Same list for Issuer table and CTOS cross-check (one row per IC/kind after merge)
   * INPUT: extractDirectorShareholders output
   * OUTPUT: mergeDirectorShareholderRowsForCtosCompare(rows)
   * WHERE USED: Issuer block + directorCtosComparisonTableRows
   */
  const directorShareholdersMerged = React.useMemo(
    () => mergeDirectorShareholderRowsForCtosCompare(directorShareholders),
    [directorShareholders]
  );

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

  const { unauditedByYear } = React.useMemo(
    () => extractQuestionnaireAndUnaudited(app.financial_statements),
    [app.financial_statements]
  );
  const hasIssuerFinancialData = Object.keys(unauditedByYear).length > 0;

  const latestCtos = ctosList?.[0];

  const directorCtosComparisonTableRows = React.useMemo((): DirectorCtosComparisonTableRow[] => {
    const ctosOrgList = USE_MOCK_DIRECTOR_SHAREHOLDER_ROWS
      ? MOCK_CTOS_ORG_DIRECTOR_ROWS
      : extractCtosOrgDirectorsFromCompanyJson(latestCtos?.company_json);
    const { tableRows } = buildDirectorCtosComparison(directorShareholdersMerged, ctosOrgList);
    return tableRows;
  }, [directorShareholdersMerged, latestCtos?.company_json]);

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

  const rawUnauditedYears = React.useMemo(
    () =>
      Object.keys(unauditedByYear)
        .map((k) => parseInt(k, 10))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b),
    [unauditedByYear]
  );

  const adminUserYears = React.useMemo(
    () => getAdminFinancialSummaryUserColumnYears(rawUnauditedYears),
    [rawUnauditedYears]
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

  const onGetSubjectCtos = (
    row: DirectorShareholderRow,
    options?: { enquiryOverride: { displayName: string; idNumber: string } }
  ) => {
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
  };

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

  const hadCtosUnauditedOverride = rawUnauditedYears.some((y) => ctosFinancialYearsSet.has(y));

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
                <span className="font-medium text-foreground">Fetch latest CTOS report</span> asks CTOS for a{" "}
                <span className="font-medium text-foreground">new</span> organization report.{" "}
                <span className="font-medium text-foreground">Financial Summary</span> and{" "}
                <span className="font-medium text-foreground">Director and Shareholders</span> show the organization data CTOS
                returns. <span className="font-medium text-foreground">View latest report</span> opens the full report from the{" "}
                <span className="font-medium text-foreground">last successful fetch</span> in a new browser tab (read-only). It
                does not request another pull from CTOS.
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
                  className="rounded-lg h-8 px-3 text-xs"
                  disabled={!latestCtos?.has_report_html || ctosLoading}
                  onClick={() => void openFullReport()}
                >
                  View latest report
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-lg h-8 px-3 text-xs"
                  disabled={createCtos.isPending || ctosLoading}
                  onClick={() => setOrgCtosConfirmOpen(true)}
                >
                  {createCtos.isPending ? "Fetching…" : "Fetch latest CTOS report"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ReviewFieldBlock>

      <ReviewFieldBlock title="Financial Summary">
        <p className="-mt-1 mb-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          CTOS columns use years from the latest organization report. User columns show only issuer-submitted years in
          the current window (up to two), smallest first; none appear if nothing was submitted. Empty CTOS slots
          (dimmed, left side) pad when the report has fewer than three years so the latest CTOS year stays next to user
          columns. <span className="font-medium text-foreground">N/A</span>{" "}
          means a ratio cannot be computed from the numbers present (see one-line formula under each computed row label).
        </p>
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
                        {spec.year != null ? String(spec.year) : spec.kind === "ctos" ? "No year" : HEADER_PLACEHOLDER}
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
                          {spec.kind === "ctos" ? (spec.year == null ? "No CTOS year" : "CTOS") : "User Input"}
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
        {directorShareholdersMerged.length > 0 ? (
          <div className="space-y-8">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Issuer</h3>
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
                    {directorShareholdersMerged.map((row) => {
                      const isApproved =
                        row.verificationStatus === "APPROVED" || row.verificationStatus === "Approved";
                      const subjectSnap = lookupSubjectReportSnap(subjectReportByRef, row.icOrSsm, row.subjectRef);
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
                              subjectRef: ctosSubjectReportLookupKey(row.icOrSsm, row.subjectRef),
                              snap: subjectSnap,
                            })}
                          </TableCell>
                          <TableCell className={applicationTableCellClass}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg h-8 text-xs"
                              disabled={
                                !ctosSubjectRefForRequest(row) ||
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
                                !ctosSubjectRefForRequest(row) ||
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
              <h3 className="mb-2 text-sm font-semibold text-foreground">CTOS</h3>
              <div className={applicationTableWrapperClass}>
                <div className="overflow-x-auto">
                  <Table className="min-w-[720px] text-[15px]">
                  <TableHeader className={applicationTableHeaderBgClass}>
                    <TableRow className="hover:bg-transparent border-b border-border">
                      <TableHead className={`${applicationTableHeaderClass} w-10 px-2`} aria-label="Expand field checks">
                        <span className="sr-only">Expand</span>
                      </TableHead>
                      <TableHead className={applicationTableHeaderClass}>Issuer Name</TableHead>
                      <TableHead className={applicationTableHeaderClass}>CTOS Name</TableHead>
                      <TableHead className={applicationTableHeaderClass}>Status</TableHead>
                      <TableHead className={applicationTableHeaderClass}>Last subject fetch</TableHead>
                      <TableHead className={applicationTableHeaderClass}>View report</TableHead>
                      <TableHead className={`${applicationTableHeaderClass} w-[140px]`}>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {directorCtosComparisonTableRows.map((row) => {
                      const actionRow = row.subjectActionRow;
                      const subjectSnap = actionRow
                        ? lookupSubjectReportSnap(subjectReportByRef, actionRow.icOrSsm, actionRow.subjectRef)
                        : undefined;
                      const canViewSubject = Boolean(subjectSnap?.has_report_html);
                      const checksOpen = Boolean(directorCtosChecksExpanded[row.id]);
                      const detailId = `director-ctos-checks-${row.id}`;
                      const toggleDirectorCtosChecksRow = () => {
                        setDirectorCtosChecksExpanded((prev) => ({
                          ...prev,
                          [row.id]: !prev[row.id],
                        }));
                      };
                      return (
                        <React.Fragment key={row.id}>
                          <TableRow
                            className={cn(applicationTableRowClass, "cursor-pointer")}
                            aria-expanded={checksOpen}
                            aria-controls={detailId}
                            onClick={(e) => {
                              const t = e.target as HTMLElement;
                              if (t.closest("button, a")) return;
                              toggleDirectorCtosChecksRow();
                            }}
                          >
                            <TableCell className={`${applicationTableCellClass} w-10 px-2 align-middle`}>
                              <span
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
                                aria-hidden
                              >
                                <ChevronRightIcon
                                  className={cn("h-4 w-4 transition-transform duration-200", checksOpen && "rotate-90")}
                                />
                              </span>
                            </TableCell>
                            <TableCell className={`${applicationTableCellClass} font-medium`}>
                              {row.issuerName === HEADER_PLACEHOLDER ? (
                                <span className="text-muted-foreground">{HEADER_PLACEHOLDER}</span>
                              ) : (
                                row.issuerName
                              )}
                            </TableCell>
                            <TableCell className={`${applicationTableCellClass} font-medium`}>
                              {row.ctosName === HEADER_PLACEHOLDER ? (
                                <span className="text-muted-foreground">{HEADER_PLACEHOLDER}</span>
                              ) : (
                                row.ctosName
                              )}
                            </TableCell>
                            <TableCell className={applicationTableCellClass}>
                              {directorCtosRowStatusDisplay(row.rowStatus)}
                            </TableCell>
                            <TableCell className={applicationTableCellClass}>
                              {actionRow ? (
                                subjectLastFetchDisplay({
                                  subjectRef: ctosSubjectReportLookupKey(
                                    actionRow.icOrSsm,
                                    actionRow.subjectRef
                                  ),
                                  snap: subjectSnap,
                                })
                              ) : (
                                <span className="text-muted-foreground">{HEADER_PLACEHOLDER}</span>
                              )}
                            </TableCell>
                            <TableCell className={applicationTableCellClass}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg h-8 text-xs"
                                disabled={
                                  !actionRow ||
                                  !ctosSubjectRefForRequest(actionRow) ||
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
                                  !actionRow ||
                                  !ctosSubjectRefForRequest(actionRow) ||
                                  !actionRow.subjectKind ||
                                  createSubjectCtos.isPending ||
                                  ctosSubjectLoading
                                }
                                onClick={() => {
                                  if (!actionRow?.icOrSsm) return;
                                  onGetSubjectCtos(actionRow, {
                                    enquiryOverride: {
                                      displayName: actionRow.name,
                                      idNumber: actionRow.icOrSsm,
                                    },
                                  });
                                }}
                              >
                                {createSubjectCtos.isPending ? "Fetching…" : "Get report"}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {checksOpen ? (
                            <TableRow className="border-b border-border bg-muted/20 hover:bg-muted/25">
                              <TableCell
                                id={detailId}
                                colSpan={7}
                                className={`${applicationTableCellClass} px-4 py-3`}
                              >
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                  <div className="space-y-1">
                                    <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Name Check
                                    </p>
                                    <div>{directorCtosFieldCheckDisplay(row.nameCheckCell)}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Role Check
                                    </p>
                                    <div>{directorCtosFieldCheckDisplay(row.roleCheckCell)}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Ownership Check
                                    </p>
                                    <div>{directorCtosFieldCheckDisplay(row.ownershipCheckCell)}</div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </div>
            </div>
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
