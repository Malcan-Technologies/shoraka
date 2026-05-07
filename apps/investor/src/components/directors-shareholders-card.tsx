"use client";

import * as React from "react";
import { UserGroupIcon, UserIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import {
  buildDirectorShareholderDisplayRowForEmailEligibility,
  filterVisiblePeopleRows,
  formatPeopleIdentityLine,
  formatPeopleRolesLineTitleCase,
  getFinalStatusBadgeClassName,
  getFinalStatusLabel,
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

function renderRow(row: DirectorShareholderDisplayRow & { __person: ApplicationPersonRow }) {
  const identityLine = formatPeopleIdentityLine(row.__person);
  const rolesLine = formatPeopleRolesLineTitleCase({
    roles: row.__person.roles ?? [],
    sharePercentage: row.__person.sharePercentage ?? null,
  });
  const finalStatus = getFinalStatusLabel({
    screening: row.__person.screening,
    onboarding: row.__person.onboarding,
  });
  return (
    <div key={row.id} className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          {identityLine ? <p className="font-mono text-xs text-muted-foreground">{identityLine}</p> : null}
          {row.email.trim() ? <p className="text-xs text-muted-foreground break-all">{row.email}</p> : null}
          <p className="text-xs text-muted-foreground">{rolesLine || "—"}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
          <span className="text-xs text-muted-foreground">Status</span>
          <Badge
            variant="outline"
            className={cn(
              "border-transparent text-[11px] font-normal",
              getFinalStatusBadgeClassName(finalStatus.tone)
            )}
          >
            {finalStatus.label}
          </Badge>
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
