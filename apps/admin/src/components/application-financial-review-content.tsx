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
import { formatCurrency, formatNumber } from "@cashsouk/config";
import { FINANCIAL_FIELD_LABELS, calculateFinancialMetrics } from "@cashsouk/types";

const COMPUTED_FIELD_LABELS: Record<string, string> = {
  totass: "Total Assets",
  totlib: "Total Liability",
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

function parseFinancialStatements(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const nested = obj.input as Record<string, unknown> | undefined;
  if (nested && typeof nested === "object") return nested as Record<string, unknown>;
  return obj;
}

interface FinancialRowDef {
  id: string;
  label: string;
  getValue: (
    fs: Record<string, unknown>,
    computed: ReturnType<typeof calculateFinancialMetrics> | null
  ) => string;
}

const FINANCIAL_ROW_DEFS: FinancialRowDef[] = [
  {
    id: "pldd",
    label: FINANCIAL_FIELD_LABELS.pldd,
    getValue: (fs) => {
      const v = fs.pldd;
      if (v == null || v === "") return "—";
      return String(v);
    },
  },
  {
    id: "bsdd",
    label: FINANCIAL_FIELD_LABELS.bsdd,
    getValue: (fs) => {
      const v = fs.bsdd;
      if (v == null || v === "") return "—";
      return String(v);
    },
  },
  {
    id: "bsfatot",
    label: FINANCIAL_FIELD_LABELS.bsfatot,
    getValue: (fs) => {
      const v = fs.bsfatot;
      if (v == null || v === "") return "—";
      return formatCurrency(toNum(v), { decimals: 0 });
    },
  },
  {
    id: "othass",
    label: FINANCIAL_FIELD_LABELS.othass,
    getValue: (fs) => {
      const v = fs.othass;
      if (v == null || v === "") return "—";
      return formatCurrency(toNum(v), { decimals: 0 });
    },
  },
  {
    id: "bscatot",
    label: FINANCIAL_FIELD_LABELS.bscatot,
    getValue: (fs) => {
      const v = fs.bscatot;
      if (v == null || v === "") return "—";
      return formatCurrency(toNum(v), { decimals: 0 });
    },
  },
  {
    id: "bsclbank",
    label: FINANCIAL_FIELD_LABELS.bsclbank,
    getValue: (fs) => {
      const v = fs.bsclbank;
      if (v == null || v === "") return "—";
      return formatCurrency(toNum(v), { decimals: 0 });
    },
  },
  {
    id: "totass",
    label: COMPUTED_FIELD_LABELS.totass,
    getValue: (_fs, computed) => {
      if (!computed) return "—";
      const n = computed.totass;
      return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
    },
  },
  {
    id: "curlib",
    label: FINANCIAL_FIELD_LABELS.curlib,
    getValue: (fs) => {
      const v = fs.curlib;
      if (v == null || v === "") return "—";
      return formatCurrency(toNum(v), { decimals: 0 });
    },
  },
  {
    id: "bsslltd",
    label: FINANCIAL_FIELD_LABELS.bsslltd,
    getValue: (fs) => {
      const v = fs.bsslltd;
      if (v == null || v === "") return "—";
      return formatCurrency(toNum(v), { decimals: 0 });
    },
  },
  {
    id: "bsclstd",
    label: FINANCIAL_FIELD_LABELS.bsclstd,
    getValue: (fs) => {
      const v = fs.bsclstd;
      if (v == null || v === "") return "—";
      return formatCurrency(toNum(v), { decimals: 0 });
    },
  },
  {
    id: "totlib",
    label: COMPUTED_FIELD_LABELS.totlib,
    getValue: (_fs, computed) => {
      if (!computed) return "—";
      const n = computed.totlib;
      return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
    },
  },
  {
    id: "bsqpuc",
    label: FINANCIAL_FIELD_LABELS.bsqpuc,
    getValue: (fs) => {
      const v = fs.bsqpuc;
      if (v == null || v === "") return "—";
      return formatCurrency(toNum(v), { decimals: 0 });
    },
  },
  {
    id: "turnover",
    label: FINANCIAL_FIELD_LABELS.turnover,
    getValue: (fs) => {
      const v = fs.turnover;
      if (v == null || v === "") return "—";
      return formatCurrency(toNum(v), { decimals: 0 });
    },
  },
  {
    id: "plnpbt",
    label: FINANCIAL_FIELD_LABELS.plnpbt,
    getValue: (fs) => {
      const v = fs.plnpbt;
      if (v == null || v === "") return "—";
      return formatCurrency(toNum(v), { decimals: 0 });
    },
  },
  {
    id: "plnpat",
    label: FINANCIAL_FIELD_LABELS.plnpat,
    getValue: (fs) => {
      const v = fs.plnpat;
      if (v == null || v === "") return "—";
      return formatCurrency(toNum(v), { decimals: 0 });
    },
  },
  {
    id: "plnetdiv",
    label: FINANCIAL_FIELD_LABELS.plnetdiv,
    getValue: (fs) => {
      const v = fs.plnetdiv;
      if (v == null || v === "") return "—";
      return formatCurrency(toNum(v), { decimals: 0 });
    },
  },
  {
    id: "plyear",
    label: FINANCIAL_FIELD_LABELS.plyear,
    getValue: (fs) => {
      const v = fs.plyear;
      if (v == null || v === "") return "—";
      return formatCurrency(toNum(v), { decimals: 0 });
    },
  },
  {
    id: "turnover_growth",
    label: COMPUTED_FIELD_LABELS.turnover_growth,
    getValue: (_fs, computed) => {
      if (!computed || computed.turnover_growth == null) return "—";
      return formatNumber(computed.turnover_growth * 100, 2) + "%";
    },
  },
  {
    id: "profit_margin",
    label: COMPUTED_FIELD_LABELS.profit_margin,
    getValue: (_fs, computed) => {
      if (!computed || computed.profit_margin == null) return "—";
      return formatNumber(computed.profit_margin * 100, 2) + "%";
    },
  },
  {
    id: "return_of_equity",
    label: COMPUTED_FIELD_LABELS.return_of_equity,
    getValue: (_fs, computed) => {
      if (!computed || computed.return_of_equity == null) return "—";
      return formatNumber(computed.return_of_equity * 100, 2) + "%";
    },
  },
  {
    id: "currat",
    label: COMPUTED_FIELD_LABELS.currat,
    getValue: (_fs, computed) => {
      if (!computed || computed.currat == null) return "—";
      return formatNumber(computed.currat, 2);
    },
  },
  {
    id: "workcap",
    label: COMPUTED_FIELD_LABELS.workcap,
    getValue: (_fs, computed) => {
      if (!computed) return "—";
      return formatCurrency(computed.workcap, { decimals: 0 });
    },
  },
];

interface DirectorShareholderRow {
  id: string;
  name: string;
  role: string;
  ownership: string | null;
  verificationLabel: "KYC" | "KYB";
  verificationStatus: string | null;
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

function extractDirectorShareholders(
  issuerOrg: {
    corporate_entities?: unknown;
    director_kyc_status?: unknown;
    director_aml_status?: unknown;
  } | null | undefined
): DirectorShareholderRow[] {
  const corporateEntities = issuerOrg?.corporate_entities as Record<string, unknown> | null | undefined;
  const directorKycStatus = issuerOrg?.director_kyc_status as Record<string, unknown> | null | undefined;
  const directorAmlStatus = issuerOrg?.director_aml_status as Record<string, unknown> | null | undefined;

  const rows: DirectorShareholderRow[] = [];
  let idx = 0;

  const kycDirectors = Array.isArray(directorKycStatus?.directors)
    ? (directorKycStatus.directors as Record<string, unknown>[])
    : [];
  const kycShareholders = Array.isArray(directorKycStatus?.individualShareholders)
    ? (directorKycStatus.individualShareholders as Record<string, unknown>[])
    : [];

  const mergedByEmail = new Map<
    string,
    { name: string; roles: string[]; ownership: string | null; kycStatus: string | null }
  >();
  for (const d of [...kycDirectors, ...kycShareholders]) {
    const email = String(d.email || "").toLowerCase().trim();
    if (!email) continue;
    const name = String(d.name || "Unknown");
    const role = d.role ? String(d.role) : "";
    const pctMatch = role.match(/(\d+)%/);
    const ownership = extractOwnershipFromRole(role) ?? (pctMatch ? `${pctMatch[1]}% ownership` : null);
    const kycStatus = d.kycStatus ? String(d.kycStatus) : null;

    const existing = mergedByEmail.get(email);
    if (existing) {
      if (!existing.roles.some((r) => r.toLowerCase().includes("shareholder")) && role.toLowerCase().includes("shareholder")) {
        existing.roles.push(role);
      }
      if (ownership && !existing.ownership) existing.ownership = ownership;
      if (kycStatus) existing.kycStatus = kycStatus;
    } else {
      mergedByEmail.set(email, {
        name,
        roles: [role],
        ownership,
        kycStatus,
      });
    }
  }

  for (const [, v] of mergedByEmail) {
    const combinedRole = v.roles.join(", ");
    rows.push({
      id: `person-${idx++}`,
      name: v.name,
      role: getRoleLabel(combinedRole, false),
      ownership: v.ownership,
      verificationLabel: "KYC",
      verificationStatus: v.kycStatus,
    });
  }

  const corpShareholders = Array.isArray(corporateEntities?.corporateShareholders)
    ? (corporateEntities.corporateShareholders as Record<string, unknown>[])
    : [];
  const businessAml = Array.isArray(directorAmlStatus?.businessShareholders)
    ? (directorAmlStatus.businessShareholders as Record<string, unknown>[])
    : [];

  const getCorpOwnership = (corp: Record<string, unknown>): string | null => {
    const formContent = corp.formContent as Record<string, unknown> | undefined;
    const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
    for (const area of displayAreas) {
      const content = Array.isArray((area as Record<string, unknown>)?.content)
        ? (area as Record<string, unknown>).content as Array<{ fieldName?: string; fieldValue?: string }>
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

  for (const corp of corpShareholders) {
    const codRequestId = (corp.corporateOnboardingRequest as Record<string, unknown>)?.requestId ?? corp.requestId;
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
      id: `corp-${idx++}`,
      name: getCorpName(corp),
      role: "Corporate Shareholder",
      ownership,
      verificationLabel: "KYB",
      verificationStatus: amlStatus ?? (codStatus ? String(codStatus) : null),
    });
  }

  if (rows.length === 0) {
    const directors = Array.isArray(corporateEntities?.directors)
      ? (corporateEntities.directors as Record<string, unknown>[])
      : [];
    const shareholders = Array.isArray(corporateEntities?.shareholders)
      ? (corporateEntities.shareholders as Record<string, unknown>[])
      : [];
    const addFromCorpEntities = (p: Record<string, unknown>, roleLabel: string) => {
      const info = p.personalInfo as Record<string, unknown> | undefined;
      const name = String(
        info?.fullName || `${info?.firstName || ""} ${info?.lastName || ""}`.trim() || "Unknown"
      );
      const formContent = (info?.formContent ?? p.formContent) as Record<string, unknown> | undefined;
      const content = Array.isArray(formContent?.content) ? formContent.content : [];
      const displayAreas = Array.isArray(formContent?.displayAreas) ? formContent.displayAreas : [];
      const basicInfo = displayAreas.find(
        (a: Record<string, unknown>) => a.displayArea === "Basic Information Setting"
      ) as { content?: Array<{ fieldName?: string; fieldValue?: string }> } | undefined;
      const areaContent = Array.isArray(basicInfo?.content) ? basicInfo.content : [];
      const shareField = content.find((f: { fieldName?: string }) => f.fieldName === "% of Shares") ??
        areaContent.find((f: { fieldName?: string }) => f.fieldName === "% of Shares");
      const ownership = shareField?.fieldValue ? `${shareField.fieldValue}% ownership` : null;
      const status = p.status ?? p.approveStatus;
      rows.push({
        id: `person-${idx++}`,
        name,
        role: roleLabel,
        ownership,
        verificationLabel: "KYC",
        verificationStatus: status ? String(status) : null,
      });
    };
    for (const p of directors) addFromCorpEntities(p, "Director");
    for (const p of shareholders) addFromCorpEntities(p, "Shareholder");
    for (const corp of corpShareholders) {
      rows.push({
        id: `corp-${idx++}`,
        name: getCorpName(corp),
        role: "Corporate Shareholder",
        ownership: getCorpOwnership(corp),
        verificationLabel: "KYB",
        verificationStatus: (corp.status ?? corp.approveStatus) ? String(corp.status ?? corp.approveStatus) : null,
      });
    }
  }

  return rows;
}

interface ApplicationFinancialReviewContentProps {
  app: {
    issuer_organization?: {
      corporate_entities?: unknown;
      director_kyc_status?: unknown;
      director_aml_status?: unknown;
    } | null;
    financial_statements?: unknown;
  };
}

export function ApplicationFinancialReviewContent({ app }: ApplicationFinancialReviewContentProps) {
  const directorShareholders = React.useMemo(
    () => extractDirectorShareholders(app.issuer_organization),
    [app.issuer_organization]
  );

  const { parsedFs, computed } = React.useMemo(() => {
    const fs = parseFinancialStatements(app.financial_statements);
    const hasData = Object.keys(fs).length > 0;
    const input = {
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
    const metrics = hasData ? calculateFinancialMetrics(input) : null;
    return { parsedFs: fs, computed: metrics };
  }, [app.financial_statements]);

  return (
    <>
      <ReviewFieldBlock title="Financial Data">
        <div className="flex justify-end mb-3">
          <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" disabled>
            Get Updated Financial Data
          </Button>
        </div>
        <div className={applicationTableWrapperClass}>
          <Table className="table-fixed text-sm">
            <TableHeader className={applicationTableHeaderBgClass}>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="text-sm font-semibold text-foreground px-3 py-2 w-[22%] min-w-[140px] border-r border-border">
                  Financial Item
                </TableHead>
                <TableHead className="text-sm font-semibold text-foreground px-3 py-2 w-[19.5%] border-r border-border">
                  2023
                </TableHead>
                <TableHead className="text-sm font-semibold text-foreground px-3 py-2 w-[19.5%] border-r border-border">
                  2024
                </TableHead>
                <TableHead className="text-sm font-semibold text-foreground px-3 py-2 w-[19.5%] border-r border-border">
                  2025
                </TableHead>
                <TableHead className="text-sm font-semibold text-foreground px-3 py-2 text-right tabular-nums w-[19.5%]">
                  2026 (Unaudited)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FINANCIAL_ROW_DEFS.map((row) => (
                <TableRow key={row.id} className="border-b border-border last:border-b-0 odd:bg-muted/40 hover:bg-muted">
                  <TableCell className="text-sm px-3 py-2 border-r border-border font-medium">
                    {row.label}
                  </TableCell>
                  <TableCell className="text-sm px-3 py-2 text-muted-foreground border-r border-border text-left">—</TableCell>
                  <TableCell className="text-sm px-3 py-2 text-muted-foreground border-r border-border text-left">—</TableCell>
                  <TableCell className="text-sm px-3 py-2 text-muted-foreground border-r border-border text-left">—</TableCell>
                  <TableCell className="text-sm px-3 py-2 text-right tabular-nums">
                    {row.getValue(parsedFs, computed)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Extract button only appears if no data has been extracted previously. Automatically populate
          the table if data is available (from previous application).
        </p>
        <Button variant="secondary" size="sm" className="rounded-lg mt-2 h-8 text-xs" disabled>
          Extract Audited Financial Data
        </Button>
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
                      <TableCell className={applicationTableCellMutedClass}>
                        View (—)
                      </TableCell>
                      <TableCell className={applicationTableCellMutedClass}>—</TableCell>
                      <TableCell className={applicationTableCellClass}>
                        <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" disabled>
                          Get Credit Report
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
