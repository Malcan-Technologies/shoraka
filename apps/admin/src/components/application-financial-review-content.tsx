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
  ChartBarIcon,
  CheckCircleIcon,
  DocumentMagnifyingGlassIcon,
  SparklesIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

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
  };
}

export function ApplicationFinancialReviewContent({ app }: ApplicationFinancialReviewContentProps) {
  const directorShareholders = React.useMemo(
    () => extractDirectorShareholders(app.issuer_organization),
    [app.issuer_organization]
  );

  return (
    <div className="space-y-6">
      {/* 1. Financial Data */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <ChartBarIcon className="h-4 w-4 text-muted-foreground" />
            Financial Data
          </h4>
          <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" disabled>
            Get Updated Financial Data
          </Button>
        </div>
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground">2023</TableHead>
                <TableHead className="text-muted-foreground">2024</TableHead>
                <TableHead className="text-muted-foreground">2025</TableHead>
                <TableHead className="text-muted-foreground">2026 Management Data (Unaudited)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell className="text-muted-foreground">Data pending internal API</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Extract button only appears if no data has been extracted previously. Automatically populate
          the table if data is available (from previous application).
        </p>
        <Button variant="secondary" size="sm" className="rounded-lg mt-2" disabled>
          Extract Audited Financial Data
        </Button>
      </div>

      {/* 2. Company Credit Score */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <DocumentMagnifyingGlassIcon className="h-4 w-4 text-muted-foreground" />
            Company Credit Score
            <span className="text-xs font-normal text-muted-foreground">
              Last updated —
            </span>
          </h4>
          <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" disabled>
            Get Updated Credit Score
          </Button>
        </div>
        <div className="rounded-xl border bg-card overflow-hidden min-h-[80px] flex items-center justify-center">
          <p className="text-sm text-muted-foreground py-6">
            Credit score data will be populated from external API (e.g. CTOS).
          </p>
        </div>
      </div>

      {/* 3. Director & Shareholders */}
      <div>
        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <UserGroupIcon className="h-4 w-4 text-muted-foreground" />
          Director & Shareholders
        </h4>
        {directorShareholders.length > 0 ? (
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Role</TableHead>
                  <TableHead className="text-muted-foreground">Director</TableHead>
                  <TableHead className="text-muted-foreground">Ownership</TableHead>
                  <TableHead className="text-muted-foreground">KYC / KYB</TableHead>
                  <TableHead className="text-muted-foreground">Last Credit Report</TableHead>
                  <TableHead className="text-muted-foreground">Last Credit Score</TableHead>
                  <TableHead className="text-muted-foreground w-[140px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directorShareholders.map((row) => {
                  const isApproved =
                    row.verificationStatus === "APPROVED" || row.verificationStatus === "Approved";
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground text-sm">{row.role}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.ownership ?? "—"}</TableCell>
                      <TableCell>
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
                      <TableCell className="text-muted-foreground">
                        View (—)
                      </TableCell>
                      <TableCell className="text-muted-foreground">—</TableCell>
                      <TableCell>
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
          <div className="rounded-xl border bg-card min-h-[80px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground py-6">
              No director or shareholder data available. Data is sourced from organization profile.
            </p>
          </div>
        )}
      </div>

      {/* 4. Cashsouk Intelligence */}
      <div>
        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <SparklesIcon className="h-4 w-4 text-muted-foreground" />
          Cashsouk Intelligence
          <span className="text-xs font-normal text-muted-foreground">Score: —</span>
        </h4>
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-6">
            <p className="text-sm text-muted-foreground">
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
      </div>
    </div>
  );
}
