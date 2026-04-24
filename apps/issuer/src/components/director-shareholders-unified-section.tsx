"use client";

import * as React from "react";
import {
  UserGroupIcon,
  UserIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import {
  getDirectorShareholderDisplayRows,
  type DirectorShareholderDisplayRow,
} from "@cashsouk/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface DirectorShareholdersUnifiedSectionProps {
  corporateEntities: unknown;
  directorKycStatus: unknown;
  organizationCtosCompanyJson?: unknown | null;
  className?: string;
}

function roleLower(r: DirectorShareholderDisplayRow): string {
  return r.role.toLowerCase();
}

function isDirectorLikeRow(r: DirectorShareholderDisplayRow): boolean {
  return r.type === "INDIVIDUAL" && roleLower(r).includes("director");
}

function isIndividualShareholderOnlyRow(r: DirectorShareholderDisplayRow): boolean {
  return r.type === "INDIVIDUAL" && !roleLower(r).includes("director");
}

export function DirectorShareholdersUnifiedSection({
  corporateEntities,
  directorKycStatus,
  organizationCtosCompanyJson,
  className,
}: DirectorShareholdersUnifiedSectionProps) {
  const [sentRowIds, setSentRowIds] = React.useState<Set<string>>(() => new Set());
  const [draftEmails, setDraftEmails] = React.useState<Record<string, string>>({});
  const [confirmRow, setConfirmRow] = React.useState<DirectorShareholderDisplayRow | null>(null);

  const rows = React.useMemo(
    () =>
      getDirectorShareholderDisplayRows({
        corporateEntities,
        directorKycStatus,
        organizationCtosCompanyJson,
        sentRowIds,
      }),
    [corporateEntities, directorKycStatus, organizationCtosCompanyJson, sentRowIds]
  );

  const directorLikeRows = React.useMemo(() => rows.filter(isDirectorLikeRow), [rows]);
  const shareholderOnlyRows = React.useMemo(() => rows.filter(isIndividualShareholderOnlyRow), [rows]);
  const corporateRows = React.useMemo(() => rows.filter((r) => r.type === "COMPANY"), [rows]);

  const displayEmail = React.useCallback(
    (row: DirectorShareholderDisplayRow) => {
      const d = draftEmails[row.id];
      if (d !== undefined) return d;
      return row.email;
    },
    [draftEmails]
  );

  const commitSend = () => {
    if (!confirmRow) return;
    const email = displayEmail(confirmRow).trim();
    if (email) setDraftEmails((prev) => ({ ...prev, [confirmRow.id]: email }));
    setSentRowIds((prev) => new Set(prev).add(confirmRow.id));
    setConfirmRow(null);
  };

  const renderPersonRow = (row: DirectorShareholderDisplayRow) => {
    const ic = row.idNumber?.trim();
    const em = displayEmail(row);
    const showEmailControls =
      !sentRowIds.has(row.id) && row.status !== "Sent" && (!em.trim() || row.status === "Missing");

    return (
      <div
        key={row.id}
        className="flex flex-col gap-3 p-4 rounded-lg border bg-muted/30 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {row.name}
            {ic ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                · IC {ic}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{em.trim() ? em : "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">{row.role}</p>
          {row.ownershipDisplay?.trim() ? (
            <p className="text-xs text-muted-foreground mt-1">{row.ownershipDisplay}</p>
          ) : null}
          <p className="text-xs text-muted-foreground mt-1">Status: {row.status}</p>
        </div>
        {showEmailControls ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
            <Input
              type="email"
              className="h-11 max-w-full rounded-xl border bg-background sm:max-w-xs"
              placeholder="Email"
              value={em}
              onChange={(e) => setDraftEmails((prev) => ({ ...prev, [row.id]: e.target.value }))}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full gap-2 rounded-xl sm:w-auto"
              onClick={() => setConfirmRow(row)}
            >
              Confirm and send onboarding link
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderCorpRow = (row: DirectorShareholderDisplayRow) => (
    <div key={row.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{row.name}</p>
        {row.registrationNumber?.trim() ? (
          <p className="text-xs text-muted-foreground mt-1">SSM {row.registrationNumber}</p>
        ) : null}
        <p className="text-xs text-muted-foreground mt-1">
          {row.ownershipDisplay?.trim() ? row.ownershipDisplay : "Shareholder"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Status: {row.status}</p>
      </div>
    </div>
  );

  const emptyAll =
    directorLikeRows.length === 0 && shareholderOnlyRows.length === 0 && corporateRows.length === 0;

  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-lg font-semibold">Directors and Shareholders</h2>
          <p className="text-sm text-muted-foreground">Directors and shareholders details</p>
        </div>
      </div>
      <div className="p-6 space-y-6">
        {emptyAll ? (
          <p className="text-sm text-muted-foreground text-center py-8">No directors or shareholders listed.</p>
        ) : (
          <>
            {directorLikeRows.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserGroupIcon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Directors / Controllers / Authorised Personnel</h3>
                </div>
                <div className="space-y-3">{directorLikeRows.map(renderPersonRow)}</div>
              </div>
            ) : null}

            {shareholderOnlyRows.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Individual Shareholders / Ultimate Beneficiaries</h3>
                </div>
                <div className="space-y-3">{shareholderOnlyRows.map(renderPersonRow)}</div>
              </div>
            ) : null}

            {corporateRows.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BuildingOffice2Icon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Business Shareholders / Beneficiaries</h3>
                </div>
                <div className="space-y-3">{corporateRows.map(renderCorpRow)}</div>
                <p className="text-xs text-muted-foreground">
                  Corporate shareholders/beneficiaries associated with your organization.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Dialog open={confirmRow != null} onOpenChange={(open: boolean) => !open && setConfirmRow(null)}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Send onboarding link</DialogTitle>
            <DialogDescription>
              {confirmRow
                ? `Mark onboarding as sent for ${confirmRow.name}? RegTank is not called in this preview.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => setConfirmRow(null)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-lg" onClick={commitSend}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
