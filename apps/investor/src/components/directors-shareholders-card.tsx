"use client";

import * as React from "react";
import { UserGroupIcon, UserIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import {
  buildDirectorShareholderDisplayRowForEmailEligibility,
  filterVisiblePeopleRows,
  getDisplayRoleLabel,
  normalizeRawStatus,
  regtankDisplayStatusBadgeClass,
  toTitleCase,
  type ApplicationPersonRow,
  type DirectorShareholderDisplayRow,
} from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DirectorsShareholdersCardProps {
  people: ApplicationPersonRow[];
}

function isDirectorLikeRow(r: DirectorShareholderDisplayRow): boolean {
  return r.type === "INDIVIDUAL" && Boolean(r.isDirector);
}

function isIndividualShareholderOnlyRow(r: DirectorShareholderDisplayRow): boolean {
  return r.type === "INDIVIDUAL" && !Boolean(r.isDirector) && Boolean(r.isShareholder);
}

function renderStatusBadge(raw: string | null | undefined) {
  const status = normalizeRawStatus(raw);
  if (!status) return null;
  return (
    <Badge className={cn("text-xs font-medium", regtankDisplayStatusBadgeClass(status))}>{toTitleCase(status)}</Badge>
  );
}

function roleLabel(row: DirectorShareholderDisplayRow): string {
  if (row.type === "COMPANY") return row.role || "Corporate Shareholder";
  return (
    getDisplayRoleLabel({
      isDirector: row.isDirector ?? false,
      isShareholder: row.isShareholder ?? false,
      sharePercentage: row.sharePercentage,
    }) || row.role
  );
}

function renderRow(row: DirectorShareholderDisplayRow & { __person: ApplicationPersonRow }) {
  const ic = row.idNumber?.trim() || "";
  const ssm = row.registrationNumber?.trim() || "";
  return (
    <div key={row.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">
          {row.name}
          {ic ? <span className="font-normal text-muted-foreground"> · IC {ic}</span> : null}
        </p>
        {!ic && ssm ? <p className="text-xs text-muted-foreground mt-1">SSM {ssm}</p> : null}
        {row.email.trim() ? <p className="text-xs text-muted-foreground mt-1">{row.email}</p> : null}
        <p className="text-xs text-muted-foreground mt-1">{roleLabel(row)}</p>
        <div className="mt-1 flex flex-wrap flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">KYC</span>
            {renderStatusBadge(row.__person.onboarding?.status)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">AML</span>
            {renderStatusBadge(row.__person.screening?.status)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DirectorsShareholdersCard({ people }: DirectorsShareholdersCardProps) {
  const rows = React.useMemo(
    () =>
      filterVisiblePeopleRows(people).map((p) => ({
        ...buildDirectorShareholderDisplayRowForEmailEligibility(p, null),
        __person: p,
      })),
    [people]
  );

  const directorLikeRows = rows.filter(isDirectorLikeRow);
  const shareholderOnlyRows = rows.filter(isIndividualShareholderOnlyRow);
  const corporateRows = rows.filter((r) => r.type === "COMPANY");
  const emptyAll = directorLikeRows.length === 0 && shareholderOnlyRows.length === 0 && corporateRows.length === 0;

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-lg font-semibold">Directors and Shareholders</h2>
          <p className="text-sm text-muted-foreground">Directors and shareholders details</p>
        </div>
      </div>
      <div className="p-6 space-y-6">
        {directorLikeRows.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">Directors / Controllers / Authorised Personnel</h3>
            </div>
            <div className="space-y-3">{directorLikeRows.map(renderRow)}</div>
          </div>
        ) : null}

        {shareholderOnlyRows.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">Individual Shareholders / Ultimate Beneficiaries</h3>
            </div>
            <div className="space-y-3">{shareholderOnlyRows.map(renderRow)}</div>
          </div>
        ) : null}

        {corporateRows.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BuildingOffice2Icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">Business Shareholders / Beneficiaries</h3>
            </div>
            <div className="space-y-3">{corporateRows.map(renderRow)}</div>
          </div>
        ) : null}

        {emptyAll ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No directors or shareholders information available.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
