"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DirectorShareholderNotifyButton } from "@/components/director-shareholder-notify-button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  canEnterEmailForDirectorShareholder,
  filterVisiblePeopleRows,
  formatSharePercentageCell,
  getDisplayStatus,
  formatPeopleRolesLineWithoutShare,
} from "@/lib/onboarding-people-display";
import {
  normalizeDirectorShareholderIdKey,
  regtankDisplayStatusBadgeClass,
  toTitleCase,
  type ApplicationPersonRow,
} from "@cashsouk/types";

type PendingCtosSubjectFetch = {
  subjectRef: string;
  subjectKind: "INDIVIDUAL" | "CORPORATE";
  displayName: string;
  idNumber?: string;
  partyLabel: string;
};

/**
 * SECTION: Shared Director/Shareholder table
 * WHY: Keep all pages identical and read only from people.
 * INPUT: people rows + portal/org context + actions.
 * OUTPUT: merged table rows, notify, CTOS fetch modal.
 * WHERE USED: Admin financial and organization detail pages.
 */
export function DirectorShareholderTable({
  people,
  portal,
  organizationId,
  ctosFetchPendingKey,
  ctosFetchPending,
  notifyPending,
  onFetchSubjectCtos,
  onNotify,
}: {
  people: ApplicationPersonRow[];
  portal: "issuer" | "investor";
  organizationId: string;
  ctosFetchPendingKey?: string | null;
  ctosFetchPending?: boolean;
  notifyPending?: boolean;
  onFetchSubjectCtos?: (person: ApplicationPersonRow) => void;
  onNotify?: (person: ApplicationPersonRow) => void;
}) {
  const [pendingCtosSubjectFetch, setPendingCtosSubjectFetch] = React.useState<PendingCtosSubjectFetch | null>(null);
  const rows = React.useMemo(() => mergePeopleRowsByMatchKey(filterVisiblePeopleRows(people ?? [])), [people]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No director or shareholder data.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Share %</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead>Request ID</TableHead>
              <TableHead>IC Front</TableHead>
              <TableHead>IC Back</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>CTOS</TableHead>
              <TableHead>Notify</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => {
              const canNotify = canEnterEmailForDirectorShareholder(p);
              const status = getDisplayStatus({
                screening: p.screening,
                onboarding: p.onboarding,
              });
              const normalizedSubjectRef = normalizeCtosSubjectRef(p.matchKey);
              const viewUrl = `/organizations/${portal}/${encodeURIComponent(organizationId)}?tab=ctos&subject=${encodeURIComponent(p.matchKey)}`;
              const shareDisplay = (() => {
                const rolesU = (p.roles ?? []).map((r) => String(r).toUpperCase());
                const hasDirector = rolesU.includes("DIRECTOR");
                const hasShareholder = rolesU.includes("SHAREHOLDER");
                if (hasDirector && !hasShareholder) return "—";
                return formatSharePercentageCell(p) || "—";
              })();

              return (
                <TableRow key={p.matchKey}>
                  <TableCell className="font-medium">
                    <div>{p.name ?? "—"}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-0.5">{p.matchKey}</div>
                  </TableCell>
                  <TableCell>{formatRoleTitleCaseWithoutShare(p)}</TableCell>
                  <TableCell>{shareDisplay}</TableCell>
                  <TableCell>
                    {status ? (
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[11px] font-normal ${regtankDisplayStatusBadgeClass(String(status))}`}
                      >
                        {toTitleCase(status)}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {normalizedSubjectRef || p.matchKey}
                    </span>
                  </TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">—</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          const subjectDisplayName = String(p.name ?? "").trim() || p.matchKey;
                          setPendingCtosSubjectFetch({
                            subjectRef: normalizedSubjectRef || p.matchKey,
                            subjectKind: p.entityType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL",
                            displayName: subjectDisplayName,
                            idNumber: normalizedSubjectRef || undefined,
                            partyLabel: p.name?.trim() ? `${p.name} (${p.matchKey})` : p.matchKey,
                          });
                        }}
                        disabled={ctosFetchPending === true && ctosFetchPendingKey === normalizeDirectorShareholderIdKey(p.matchKey)}
                      >
                        {ctosFetchPending === true && ctosFetchPendingKey === normalizeDirectorShareholderIdKey(p.matchKey)
                          ? "Fetching..."
                          : "Fetch"}
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8" asChild>
                        <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                          View Last
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {canNotify && onNotify ? (
                        <DirectorShareholderNotifyButton
                          rowActionable={true}
                          disabled={notifyPending === true}
                          onNotify={() => onNotify(p)}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={pendingCtosSubjectFetch !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCtosSubjectFetch(null);
        }}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Fetch latest CTOS report for this party?</AlertDialogTitle>
            <AlertDialogDescription>
              We will request a fresh CTOS report for {pendingCtosSubjectFetch?.partyLabel ?? "this party"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" disabled={ctosFetchPending === true}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg"
              disabled={ctosFetchPending === true}
              onClick={() => {
                if (!pendingCtosSubjectFetch) return;
                const row = rows.find((r) => normalizeCtosSubjectRef(r.matchKey) === pendingCtosSubjectFetch.subjectRef);
                setPendingCtosSubjectFetch(null);
                if (row && onFetchSubjectCtos) onFetchSubjectCtos(row);
              }}
            >
              {ctosFetchPending === true ? "Fetching..." : "Fetch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function mergePeopleRowsByMatchKey(rows: ApplicationPersonRow[]): ApplicationPersonRow[] {
  const map = new Map<string, ApplicationPersonRow>();
  for (const row of rows) {
    const key = normalizeDirectorShareholderIdKey(row.matchKey);
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...row, matchKey: key });
      continue;
    }
    const roleSet = new Set<string>([...(prev.roles ?? []), ...(row.roles ?? [])].map((r) => String(r).toUpperCase()));
    const prevShare = typeof prev.sharePercentage === "number" ? prev.sharePercentage : null;
    const rowShare = typeof row.sharePercentage === "number" ? row.sharePercentage : null;
    map.set(key, {
      ...prev,
      matchKey: key,
      roles: Array.from(roleSet),
      sharePercentage: prevShare != null && rowShare != null ? Math.max(prevShare, rowShare) : prevShare ?? rowShare,
      name: prev.name ?? row.name ?? null,
      onboarding: prev.onboarding ?? row.onboarding ?? null,
      screening: prev.screening ?? row.screening ?? null,
      email: prev.email ?? row.email ?? "",
    });
  }
  return Array.from(map.values());
}

function normalizeCtosSubjectRef(raw: string): string {
  return String(raw ?? "").replace(/[^a-zA-Z0-9]/g, "");
}

function formatRoleTitleCaseWithoutShare(p: { roles: string[]; sharePercentage: number | null }): string {
  return formatPeopleRolesLineWithoutShare(p).replace(/\bDIRECTOR\b/g, "Director").replace(/\bSHAREHOLDER\b/g, "Shareholder");
}
