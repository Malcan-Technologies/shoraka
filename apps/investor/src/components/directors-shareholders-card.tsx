"use client";

import * as React from "react";
import {
  UserGroupIcon,
  UserIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import {
  filterVisiblePeopleRows,
  formatPeopleRolesLine,
  getCtosPartySupplementFlatRead,
  getDisplayKycStatus,
  normalizeDirectorShareholderIdKey,
  regtankDisplayStatusBadgeClass,
  type ApplicationPersonRow,
  type DirectorShareholderDisplayRow,
} from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function isDirectorLikeRow(r: DirectorShareholderDisplayRow): boolean {
  if (r.type !== "INDIVIDUAL") return false;
  if (typeof r.isDirector === "boolean") return r.isDirector;
  return r.role.toLowerCase().includes("director");
}

function isIndividualShareholderOnlyRow(r: DirectorShareholderDisplayRow): boolean {
  if (r.type !== "INDIVIDUAL") return false;
  if (typeof r.isDirector === "boolean") return !r.isDirector && Boolean(r.isShareholder);
  return !r.role.toLowerCase().includes("director");
}

function personToDisplayRow(
  p: ApplicationPersonRow,
  onboardingByPartyKey: Map<string, Record<string, unknown>>
): DirectorShareholderDisplayRow {
  const pk = normalizeDirectorShareholderIdKey(p.matchKey);
  const sup = pk ? onboardingByPartyKey.get(pk) ?? {} : {};
  const flat = getCtosPartySupplementFlatRead(sup);
  const requestId = flat.requestId;
  const regtankStatus = flat.regtankStatus;
  const kycBlock = flat.kycBlock;
  const kycRawStatus = kycBlock ? String(kycBlock.rawStatus ?? "").trim() || null : null;
  const status = getDisplayKycStatus({
    requestId,
    regtankStatus,
    kycRawStatus,
    rawStatus: null,
  });
  const rolesU = (p.roles ?? []).map((r) => r.toUpperCase());
  const isDirector = rolesU.includes("DIRECTOR");
  const isShareholder = rolesU.includes("SHAREHOLDER");
  const sharePct = p.sharePercentage;
  const ownershipDisplay =
    sharePct != null && Number.isFinite(sharePct) ? `${sharePct}% ownership` : null;
  const email = String(sup.email ?? sup.contactEmail ?? "").trim();
  const draftEligible =
    p.entityType === "INDIVIDUAL" &&
    (isDirector || (isShareholder && (sharePct ?? 0) >= 5));
  return {
    id: p.matchKey,
    name: p.name ?? "",
    role: formatPeopleRolesLine(p),
    type: p.entityType === "CORPORATE" ? "COMPANY" : "INDIVIDUAL",
    idNumber: p.entityType === "INDIVIDUAL" ? p.matchKey : null,
    registrationNumber: p.entityType === "CORPORATE" ? p.matchKey : null,
    ownershipDisplay,
    email,
    status,
    canEnterEmail: true,
    canSendOnboarding: true,
    enquiryId: null,
    subjectKind: p.entityType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL",
    ctosIndividualKycEligible: draftEligible,
    isDirector,
    isShareholder,
    sharePercentage: sharePct,
  };
}

export interface DirectorsShareholdersCardProps {
  people: ApplicationPersonRow[];
  ctosPartySupplements?: { partyKey: string; onboardingJson?: unknown }[] | null;
}

function renderIndividualRow(row: DirectorShareholderDisplayRow) {
  const ic = row.idNumber?.trim() || "";
  const kycBadge = regtankDisplayStatusBadgeClass(row.status);
  return (
    <div
      key={row.id}
      className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">
          {row.name}
          {ic ? <span className="font-normal text-muted-foreground"> · IC {ic}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{row.email.trim() ? row.email : "—"}</p>
        <p className="text-xs text-muted-foreground mt-1">{row.role}</p>
        <div className="mt-1 flex flex-wrap flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">KYC</span>
            <Badge className={cn("text-xs font-medium", kycBadge)}>{row.status}</Badge>
          </div>
          {row.amlStatus?.trim() ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">AML</span>
              <Badge variant="outline" className="text-xs font-medium">
                {row.amlStatus}
              </Badge>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function renderCorporateRow(row: DirectorShareholderDisplayRow) {
  const ssm = row.registrationNumber?.trim() || "";
  const kycBadge = regtankDisplayStatusBadgeClass(row.status);
  return (
    <div
      key={row.id}
      className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{row.name}</p>
        {ssm ? <p className="text-xs text-muted-foreground mt-1">SSM {ssm}</p> : null}
        <p className="text-xs text-muted-foreground mt-1">
          {row.role?.trim() ? row.role : "Corporate Shareholder"}
        </p>
        <div className="mt-1 flex flex-wrap flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">KYC</span>
            <Badge className={cn("text-xs font-medium", kycBadge)}>{row.status}</Badge>
          </div>
          {row.amlStatus?.trim() ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">AML</span>
              <Badge variant="outline" className="text-xs font-medium">
                {row.amlStatus}
              </Badge>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DirectorsShareholdersCard({
  people,
  ctosPartySupplements = null,
}: DirectorsShareholdersCardProps) {
  const onboardingByPartyKey = React.useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const row of ctosPartySupplements ?? []) {
      const key = normalizeDirectorShareholderIdKey(row.partyKey);
      if (!key) continue;
      const onboarding =
        row.onboardingJson && typeof row.onboardingJson === "object" && !Array.isArray(row.onboardingJson)
          ? (row.onboardingJson as Record<string, unknown>)
          : {};
      map.set(key, onboarding);
    }
    return map;
  }, [ctosPartySupplements]);

  const rows = React.useMemo(
    () => filterVisiblePeopleRows(people).map((p) => personToDisplayRow(p, onboardingByPartyKey)),
    [people, onboardingByPartyKey]
  );

  const directorLikeRows = React.useMemo(() => rows.filter(isDirectorLikeRow), [rows]);
  const shareholderOnlyRows = React.useMemo(() => rows.filter(isIndividualShareholderOnlyRow), [rows]);
  const corporateRows = React.useMemo(() => rows.filter((r) => r.type === "COMPANY"), [rows]);

  const emptyAll =
    directorLikeRows.length === 0 && shareholderOnlyRows.length === 0 && corporateRows.length === 0;

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-lg font-semibold">Directors and Shareholders</h2>
          <p className="text-sm text-muted-foreground">Directors and shareholders details</p>
        </div>
      </div>
      <div className="p-6 space-y-6">
        {directorLikeRows.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">
                Directors / Controllers / Authorised Personnel
              </h3>
            </div>
            <div className="space-y-3">{directorLikeRows.map(renderIndividualRow)}</div>
          </div>
        )}

        {shareholderOnlyRows.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">
                Individual Shareholders / Ultimate Beneficiaries
              </h3>
            </div>
            <div className="space-y-3">{shareholderOnlyRows.map(renderIndividualRow)}</div>
          </div>
        )}

        {corporateRows.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BuildingOffice2Icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">Business Shareholders / Beneficiaries</h3>
            </div>
            <div className="space-y-3">{corporateRows.map(renderCorporateRow)}</div>
            <p className="text-xs text-muted-foreground">
              Corporate shareholders/beneficiaries associated with your organization.
            </p>
          </div>
        )}

        {emptyAll && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No directors or shareholders information available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
