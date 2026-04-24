"use client";

import * as React from "react";
import {
  getDirectorShareholderDisplayRows,
  type DirectorShareholderDisplayRow,
} from "@cashsouk/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export type DirectorShareholdersUnifiedVariant = "issuer-profile" | "readonly";

export interface DirectorShareholdersUnifiedSectionProps {
  corporateEntities: unknown;
  directorKycStatus: unknown;
  organizationCtosCompanyJson?: unknown | null;
  variant: DirectorShareholdersUnifiedVariant;
  className?: string;
  /** When false, only the table is rendered (e.g. embedded in application steps). */
  showCardChrome?: boolean;
}

function icOrSsmCell(row: DirectorShareholderDisplayRow): string {
  if (row.type === "COMPANY") return row.registrationNumber?.trim() || "—";
  return row.idNumber?.trim() || "—";
}

export function DirectorShareholdersUnifiedSection({
  corporateEntities,
  directorKycStatus,
  organizationCtosCompanyJson,
  variant,
  className,
  showCardChrome = true,
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
        sentRowIds: variant === "issuer-profile" ? sentRowIds : null,
      }),
    [corporateEntities, directorKycStatus, organizationCtosCompanyJson, sentRowIds, variant]
  );

  const displayEmail = React.useCallback(
    (row: DirectorShareholderDisplayRow) => {
      const d = draftEmails[row.id];
      if (d !== undefined) return d;
      return row.email;
    },
    [draftEmails]
  );

  const openConfirm = (row: DirectorShareholderDisplayRow) => {
    setConfirmRow(row);
  };

  const commitSend = () => {
    if (!confirmRow) return;
    const email = displayEmail(confirmRow).trim();
    if (email) setDraftEmails((prev) => ({ ...prev, [confirmRow.id]: email }));
    setSentRowIds((prev) => new Set(prev).add(confirmRow.id));
    setConfirmRow(null);
  };

  const tableBlock =
    rows.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-8">No directors or shareholders listed.</p>
    ) : (
      <div className="overflow-x-auto rounded-lg border">
        <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>IC / SSM</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>KYC / KYB status</TableHead>
                  {variant === "issuer-profile" ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const em = displayEmail(row);
                  const showEmailControls =
                    variant === "issuer-profile" &&
                    !sentRowIds.has(row.id) &&
                    row.status !== "Sent" &&
                    (!em.trim() || row.status === "Missing");
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.role}</TableCell>
                      <TableCell className="tabular-nums">{icOrSsmCell(row)}</TableCell>
                      <TableCell>
                        {showEmailControls ? (
                          <Input
                            type="email"
                            className="h-9 max-w-[220px]"
                            placeholder="Email"
                            value={em}
                            onChange={(e) => setDraftEmails((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          />
                        ) : (
                          <span className={em.trim() ? "" : "text-muted-foreground"}>{em.trim() || "—"}</span>
                        )}
                      </TableCell>
                      <TableCell>{row.status}</TableCell>
                      {variant === "issuer-profile" ? (
                        <TableCell className="text-right">
                          {showEmailControls ? (
                            <Button type="button" size="sm" variant="secondary" onClick={() => openConfirm(row)}>
                              Confirm and send onboarding link
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
        </Table>
      </div>
    );

  return (
    <div className={cn(showCardChrome && "rounded-xl border bg-card", className)}>
      {showCardChrome ? (
        <>
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-lg font-semibold">Directors and shareholders</h2>
              <p className="text-sm text-muted-foreground">From onboarding and registry data</p>
            </div>
          </div>
          <div className="p-6">{tableBlock}</div>
        </>
      ) : (
        <div className="px-0 py-0">{tableBlock}</div>
      )}

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
