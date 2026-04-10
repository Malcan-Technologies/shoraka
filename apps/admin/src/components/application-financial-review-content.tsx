"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  applicationTableCellMutedClass,
  applicationTableWrapperClass,
} from "@/components/application-review/application-table-styles";
import { ReviewFieldBlock } from "@/components/application-review/review-field-block";
import { reviewEmptyStateClass } from "@/components/application-review/review-section-styles";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
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
  | { kind: "ctos"; year: number }
  | {
      kind: "unaudited";
      year: number;
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

  const directorShareholders = React.useMemo(
    () => extractDirectorShareholders(app.issuer_organization),
    [app.issuer_organization]
  );

  const subjectReportByRef = React.useMemo(() => {
    const m = new Map<string, { id: string; has_report_html: boolean }>();
    for (const r of ctosSubjectList ?? []) {
      const ref = r.subject_ref;
      if (ref) m.set(ref, { id: r.id, has_report_html: Boolean(r.has_report_html) });
    }
    return m;
  }, [ctosSubjectList]);

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

  const byYear = React.useMemo(() => {
    const m = new Map<number, CtosFinRow>();
    for (const r of financialRows) {
      if (r.reporting_year != null) m.set(r.reporting_year, r);
    }
    return m;
  }, [financialRows]);

  const ctosLatestYear = React.useMemo(() => getCtosLatestYear(financialRows), [financialRows]);

  const ctosColumnYears = React.useMemo(() => getLatestThreeCtosYears(financialRows), [financialRows]);

  const unauditedYearsSorted = React.useMemo(
    () =>
      Object.keys(unauditedByYear)
        .map((k) => parseInt(k, 10))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b),
    [unauditedByYear]
  );

  const columns = React.useMemo((): ColumnSpec[] => {
    const ctos = ctosColumnYears.map((year) => ({ kind: "ctos" as const, year }));
    const un = unauditedYearsSorted.map((year) => ({
      kind: "unaudited" as const,
      year,
      validation: questionnaire
        ? validateUnauditedColumn({
            ctosLatestYear,
            unauditedYear: year,
            latestYearSubmitted: questionnaire.submitted_this_financial_year,
            financialYearEndYear: questionnaire.latest_financial_year,
          })
        : {
            status: "PENDING" as const,
            reason: "No questionnaire on file",
          },
    }));
    console.log("Admin financial review columns (CTOS years, unaudited years):", ctosColumnYears, unauditedYearsSorted);
    return [...ctos, ...un];
  }, [ctosColumnYears, unauditedYearsSorted, questionnaire, ctosLatestYear]);

  const turnovers = React.useMemo(() => {
    return columns.map((spec) => {
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
          : computeTurnoverGrowth({
              targetYear: turnovers[idx].year,
              targetTurnover: turnovers[idx].turnover,
              priorYear: turnovers[idx - 1].year,
              priorTurnover: turnovers[idx - 1].turnover,
            });

      if (spec.kind === "ctos") {
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
      if (!spec) return null;
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
      return spec?.kind === "ctos" && !byYear.get(spec.year);
    },
    [columns, byYear]
  );

  const formatCell = (
    colIdx: number,
    _naAllowed: boolean,
    valueMissing: boolean,
    fmt: () => string
  ): string => {
    if (ctosColumnMissing(colIdx)) return "N/A";
    if (valueMissing) return "—";
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
        if (ctosColumnMissing(colIdx)) return "N/A";
        if (!computed) return "—";
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
        if (ctosColumnMissing(colIdx)) return "N/A";
        if (!computed) return "—";
        const n = computed.totlib;
        return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
      }
      case "networth": {
        if (ctosColumnMissing(colIdx)) return "N/A";
        if (!computed) return "—";
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
        if (ctosColumnMissing(colIdx)) return "N/A";
        if (!computed || computed.turnover_growth == null) return "—";
        return formatNumber(computed.turnover_growth * 100, 2) + "%";
      }
      case "profit_margin": {
        if (ctosColumnMissing(colIdx)) return "N/A";
        if (!computed || computed.profit_margin == null) return "—";
        return formatNumber(computed.profit_margin * 100, 2) + "%";
      }
      case "return_of_equity": {
        if (ctosColumnMissing(colIdx)) return "N/A";
        if (!computed || computed.return_of_equity == null) return "—";
        return formatNumber(computed.return_of_equity * 100, 2) + "%";
      }
      case "currat": {
        if (ctosColumnMissing(colIdx)) return "N/A";
        if (!computed || computed.currat == null) return "—";
        return formatNumber(computed.currat, 2);
      }
      case "workcap": {
        if (ctosColumnMissing(colIdx)) return "N/A";
        if (!computed) return "—";
        return formatCurrency(computed.workcap, { decimals: 0 });
      }
      default:
        return "—";
    }
  };

  const fetchedLabel = latestCtos?.fetched_at
    ? new Date(latestCtos.fetched_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <>
      <ReviewFieldBlock title="CTOS report">
        <div className="flex flex-wrap justify-end gap-2 mb-3">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg h-8 text-xs"
            disabled={createCtos.isPending || ctosLoading}
            onClick={onGetCtos}
          >
            {createCtos.isPending ? "Fetching…" : "Get CTOS report"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-lg h-8 text-xs"
            disabled={!latestCtos?.has_report_html || ctosLoading}
            onClick={() => void openFullReport()}
          >
            View full report
          </Button>
        </div>
        <div className={applicationTableWrapperClass}>
          {columns.length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-4">
              No CTOS year columns yet (fetch a report). Issuer has not provided unaudited columns for this
              application.
            </p>
          ) : (
            <Table className="table-fixed text-sm">
              <TableHeader className={applicationTableHeaderBgClass}>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className="text-sm font-semibold text-foreground px-3 py-2 w-[22%] min-w-[140px] border-r border-border">
                    Financial Item
                  </TableHead>
                  {columns.map((spec, i) => (
                    <TableHead
                      key={`${spec.kind}-${spec.year}-${i}`}
                      className={`text-sm font-semibold text-foreground px-3 py-2 ${
                        spec.kind === "ctos" ? "w-[16%] border-r border-border" : "w-[16%] text-right tabular-nums"
                      }`}
                    >
                      <div className={spec.kind === "unaudited" ? "flex flex-col gap-1 items-end" : ""}>
                        <span>{spec.kind === "ctos" ? String(spec.year) : `${spec.year} (Unaudited)`}</span>
                        {spec.kind === "unaudited" ? (
                          <Badge
                            variant="outline"
                            title={spec.validation.reason}
                            className={
                              spec.validation.status === "VALID"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 text-[10px] font-semibold uppercase"
                                : spec.validation.status === "PENDING"
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-900 text-[10px] font-semibold uppercase"
                                  : "border-destructive/40 bg-destructive/10 text-destructive text-[10px] font-semibold uppercase"
                            }
                          >
                            {spec.validation.status}
                          </Badge>
                        ) : null}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowLabels.map((row) => (
                  <TableRow key={row.id} className="border-b border-border last:border-b-0 odd:bg-muted/40 hover:bg-muted">
                    <TableCell className="text-sm px-3 py-2 border-r border-border font-medium">{row.label}</TableCell>
                    {columns.map((spec, ci) => (
                      <TableCell
                        key={`${spec.kind}-${spec.year}-${ci}`}
                        className={`text-sm px-3 py-2 text-left ${
                          spec.kind === "ctos" ? "border-r border-border" : "text-right tabular-nums"
                        } ${renderRowCell(row.id, ci) === "N/A" ? "text-muted-foreground" : ""}`}
                      >
                        {renderRowCell(row.id, ci)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {fetchedLabel ? (
          <p className="text-xs text-muted-foreground mt-2">Last CTOS fetch: {fetchedLabel}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">No CTOS snapshot on file for this organization yet.</p>
        )}
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

      <ReviewFieldBlock title="Director & Shareholders">
        {directorShareholders.length > 0 ? (
          <div className={applicationTableWrapperClass}>
            <Table className="text-[15px]">
              <TableHeader className={applicationTableHeaderBgClass}>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className={applicationTableHeaderClass}>Role</TableHead>
                  <TableHead className={applicationTableHeaderClass}>Director</TableHead>
                  <TableHead className={applicationTableHeaderClass}>Ownership</TableHead>
                  <TableHead className={applicationTableHeaderClass}>KYC / KYB</TableHead>
                  <TableHead className={applicationTableHeaderClass}>Last Credit Report</TableHead>
                  <TableHead className={applicationTableHeaderClass}>Last Credit Score</TableHead>
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
                      <TableCell className={applicationTableCellClass}>{row.role}</TableCell>
                      <TableCell className={`${applicationTableCellClass} font-medium`}>{row.name}</TableCell>
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
                      <TableCell className={applicationTableCellMutedClass}>—</TableCell>
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
    </>
  );
}
