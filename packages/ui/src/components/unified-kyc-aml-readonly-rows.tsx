"use client";

import type { ApplicationPersonRow, DirectorShareholderDisplayRow } from "@cashsouk/types";
import { getFinalStatusLabel, getFinalStatusToken } from "@cashsouk/types";
import { StatusBadge } from "./status-badge";
import { cn } from "../lib/utils";

export type UnifiedKycAmlDisplayRow = DirectorShareholderDisplayRow & {
  __person?: ApplicationPersonRow;
};

export interface UnifiedKycAmlReadonlyRowsProps {
  rows: UnifiedKycAmlDisplayRow[];
  isRefreshing?: boolean;
}

function finalStatusForRow(row: UnifiedKycAmlDisplayRow) {
  if (row.__person) {
    return getFinalStatusLabel({
      onboarding: row.__person.onboarding,
      screening: row.__person.screening,
    });
  }
  return getFinalStatusLabel({
    onboarding: { status: row.status },
    screening: { status: row.amlStatus ?? row.ctosRegtankStatus ?? null },
  });
}

export function UnifiedKycAmlReadonlyRows({ rows, isRefreshing }: UnifiedKycAmlReadonlyRowsProps) {
  if (rows.length === 0) return null;

  return (
    <div
      className={cn("divide-y rounded-lg border bg-card", isRefreshing && "opacity-70")}
      aria-busy={isRefreshing || undefined}
    >
      {rows.map((row) => {
        const finalStatus = finalStatusForRow(row);
        return (
          <div
            key={row.id}
            className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-ui font-medium">{row.name}</p>
              {row.email ? (
                <p className="text-meta text-muted-foreground break-all">{row.email}</p>
              ) : null}
              <p className="text-meta text-muted-foreground mt-0.5">{row.role}</p>
              {row.type === "COMPANY" && row.registrationNumber?.trim() ? (
                <p className="text-meta text-muted-foreground font-mono mt-0.5">
                  SSM {row.registrationNumber}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-meta text-muted-foreground">Status</span>
              <StatusBadge
                label={finalStatus.label}
                status={getFinalStatusToken(finalStatus.tone)}
                size="sm"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
