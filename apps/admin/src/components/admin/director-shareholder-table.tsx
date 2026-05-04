"use client";

import * as React from "react";
import { format } from "date-fns";
import { useAuthToken } from "@cashsouk/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  canManageDirectorShareholder,
  filterVisiblePeopleRows,
  formatSharePercentageCell,
  formatPeopleRolesLineWithoutShare,
} from "@/lib/onboarding-people-display";
import {
  getFinalStatusBadgeClassName,
  getFinalStatusLabel,
  getRegtankLink,
  normalizeDirectorShareholderIdKey,
  type ApplicationPersonRow,
} from "@cashsouk/types";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type CtosSubjectReportListItem = {
  id: string;
  subject_ref: string | null;
  fetched_at: string;
  has_report_html: boolean;
};

type PendingCtosSubjectFetch = {
  subjectRef: string;
  subjectKind: "INDIVIDUAL" | "CORPORATE";
  displayName: string;
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
  subjectCtosReports,
  onFetchSubjectCtos,
  onNotify,
}: {
  people: ApplicationPersonRow[];
  portal: "issuer" | "investor";
  organizationId: string;
  ctosFetchPendingKey?: string | null;
  ctosFetchPending?: boolean;
  notifyPending?: boolean;
  /** Latest CTOS report per party (matches `subject_ref` from API to IC/SSM). */
  subjectCtosReports?: CtosSubjectReportListItem[] | null;
  onFetchSubjectCtos?: (person: ApplicationPersonRow) => void;
  onNotify?: (person: ApplicationPersonRow) => void;
}) {
  const { getAccessToken } = useAuthToken();
  const [pendingCtosSubjectFetch, setPendingCtosSubjectFetch] = React.useState<PendingCtosSubjectFetch | null>(null);
  const rows = React.useMemo(() => mergePeopleRowsByMatchKey(filterVisiblePeopleRows(people ?? [])), [people]);

  /** Same flow as {@link OrganizationIssuerCtosReportsCard}: fetch HTML first, then `window.open("", "_blank")` (no `noopener`) + `document.write`. */
  const openSubjectReportHtml = React.useCallback(
    async (reportId: string) => {
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not signed in");
        return;
      }
      const url = `${API_URL}/v1/admin/organizations/${portal}/${encodeURIComponent(organizationId)}/ctos-reports/${reportId}/html`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        toast.error("Could not load report");
        return;
      }
      const html = await res.text();
      if (!html || !html.trim()) {
        toast.error("Report HTML is empty");
        return;
      }
      const w = window.open("", "_blank");
      if (!w) {
        toast.error("Popup blocked. Please allow popups.");
        return;
      }
      w.document.write(html);
      w.document.close();
    },
    [getAccessToken, organizationId, portal]
  );

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
              <TableHead>RegTank</TableHead>
              <TableHead>IC Front</TableHead>
              <TableHead>IC Back</TableHead>
              <TableHead>Last CTOS Fetch</TableHead>
              <TableHead>CTOS</TableHead>
              <TableHead>Notify</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => {
              const canNotify = canManageDirectorShareholder(p);
              const finalStatus = getFinalStatusLabel({
                screening: p.screening,
                onboarding: p.onboarding,
              });
              const latestReport = resolveLatestCtosSubjectReportForParty(subjectCtosReports, p.matchKey);
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
                    <Badge
                      variant="outline"
                      className={`border-transparent text-[11px] font-normal ${getFinalStatusBadgeClassName(finalStatus.tone)}`}
                    >
                      {finalStatus.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.screening?.riskLevel != null && String(p.screening.riskLevel).trim()
                      ? String(p.screening.riskLevel).trim()
                      : p.screening?.riskScore != null && String(p.screening.riskScore).trim()
                        ? String(p.screening.riskScore)
                        : "—"}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const rid = String(p.requestId ?? "").trim();
                      const link = getRegtankLink(p);
                      const fallback = normalizeDirectorShareholderIdKey(p.matchKey) ?? p.matchKey;
                      const displayId = rid || fallback;
                      if (link) {
                        return (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 rounded-full border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 hover:text-foreground [&_svg]:text-foreground shrink-0"
                            title={rid ? `RegTank: ${rid}` : undefined}
                            onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
                          >
                            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            View
                          </Button>
                        );
                      }
                      return <span className="font-mono text-[11px] text-muted-foreground break-all">{displayId}</span>;
                    })()}
                  </TableCell>
                  <TableCell>
                    {p.icFrontUrl ? (
                      <a
                        href={p.icFrontUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary underline underline-offset-4 hover:underline"
                      >
                        View Front
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {p.icBackUrl ? (
                      <a
                        href={p.icBackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary underline underline-offset-4 hover:underline"
                      >
                        View Back
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {latestReport?.fetched_at
                      ? (() => {
                          try {
                            return format(new Date(latestReport.fetched_at), "PPp");
                          } catch {
                            return latestReport.fetched_at;
                          }
                        })()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          const idKey = normalizeDirectorShareholderIdKey(p.matchKey);
                          if (!idKey) {
                            toast.error("Missing IC / SSM. Cannot fetch CTOS report.");
                            return;
                          }
                          const displayName = p.name?.trim();
                          if (!displayName) {
                            toast.error("Missing name. Cannot fetch CTOS report.");
                            return;
                          }
                          setPendingCtosSubjectFetch({
                            subjectRef: idKey,
                            subjectKind: p.entityType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL",
                            displayName,
                            partyLabel: `${displayName} — ${idKey}`,
                          });
                        }}
                        disabled={
                          ctosFetchPending === true &&
                          ctosFetchPendingKey === normalizeDirectorShareholderIdKey(p.matchKey)
                        }
                      >
                        {ctosFetchPending === true && ctosFetchPendingKey === normalizeDirectorShareholderIdKey(p.matchKey)
                          ? "Fetching..."
                          : "Fetch"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={!latestReport}
                        title={
                          latestReport
                            ? "Open latest CTOS HTML report"
                            : "No CTOS report yet — fetch CTOS first"
                        }
                        onClick={() => {
                          if (!latestReport?.id) return;
                          void openSubjectReportHtml(latestReport.id);
                        }}
                      >
                        View Report
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
                const ref = pendingCtosSubjectFetch.subjectRef;
                const row = rows.find((r) => normalizeDirectorShareholderIdKey(r.matchKey) === ref);
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
      requestId: prev.requestId ?? row.requestId ?? null,
      icFrontUrl: prev.icFrontUrl ?? row.icFrontUrl ?? null,
      icBackUrl: prev.icBackUrl ?? row.icBackUrl ?? null,
      email: prev.email ?? row.email ?? "",
    });
  }
  return Array.from(map.values());
}

/**
 * SECTION: Latest CTOS subject report for a director/shareholder row
 * WHY: Match API rows by normalized IC/SSM only; pick newest `fetched_at`.
 * INPUT: Report list from org detail + person `matchKey`
 * OUTPUT: Newest matching report or undefined
 * WHERE USED: Last CTOS Fetch column and View Report in DirectorShareholderTable
 */
function resolveLatestCtosSubjectReportForParty(
  reports: CtosSubjectReportListItem[] | null | undefined,
  matchKey: string
): CtosSubjectReportListItem | undefined {
  const idKey = normalizeDirectorShareholderIdKey(matchKey);
  if (!idKey) return undefined;
  const matched = (reports ?? []).filter((r) => {
    const refKey = normalizeDirectorShareholderIdKey(r.subject_ref ?? "");
    return refKey != null && refKey === idKey;
  });
  matched.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime());
  return matched[0];
}

function formatRoleTitleCaseWithoutShare(p: { roles: string[]; sharePercentage: number | null }): string {
  return formatPeopleRolesLineWithoutShare(p).replace(/\bDIRECTOR\b/g, "Director").replace(/\bSHAREHOLDER\b/g, "Shareholder");
}
