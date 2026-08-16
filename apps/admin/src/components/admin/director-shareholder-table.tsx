"use client";

import * as React from "react";
import { format } from "date-fns";
import { useAuthToken } from "@cashsouk/config";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  filterVisiblePeopleRows,
  formatSharePercentageCell,
  formatPeopleRolesLine,
  formatPeopleRolesLineWithoutShare,
  isMissingGovernmentIdPerson,
  getFinalStatusLabel,
  getRegtankColumnDisplayRows,
  normalizeDirectorShareholderIdKey,
  resolveDirectorShareholderCtosEmptyWarning,
  type ApplicationPersonRow,
  type DirectorShareholderFinalStatusTone,
  type DirectorShareholderListSource,
  type RegtankColumnDisplayRow,
} from "@cashsouk/types";
import {
  DirectorShareholderCtosEmptyAlert,
  DirectorShareholderUnresolvedIdentitySection,
  StatusBadge,
  type StatusToken,
} from "@cashsouk/ui";
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

function finalStatusToneToToken(tone: DirectorShareholderFinalStatusTone): StatusToken {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "submitted";
    case "info":
      return "in-progress";
    case "danger":
      return "rejected";
    case "expired":
      return "action";
    default:
      return "neutral";
  }
}

function RegtankColumnCell({ person }: { person: ApplicationPersonRow }) {
  const rows = getRegtankColumnDisplayRows(person);
  if (rows.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const count = rows.length;
  const recordLabel = count === 1 ? "1 record" : `${count} records`;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-xs text-muted-foreground">{recordLabel}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs shrink-0"
            aria-label={`View ${recordLabel} in RegTank`}
          >
            View
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[16.5rem] p-3" align="start" side="bottom" sideOffset={6}>
          <div className="text-sm font-medium">RegTank records</div>
          <div className="mt-2 space-y-2">
            {rows.map((row) => (
              <RegtankPopoverRecord key={`${row.kind}-${row.groupLabel}-${row.requestId}`} row={row} />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function RegtankPopoverRecord({ row }: { row: RegtankColumnDisplayRow }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] leading-4 text-muted-foreground">{row.groupLabel}</div>
      {row.url ? (
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${row.groupLabel} ${row.requestId} in RegTank`}
          className="mt-0.5 inline-flex max-w-full items-center gap-1 font-mono text-xs leading-4 text-foreground hover:text-primary hover:underline"
        >
          <span className="truncate">{row.requestId}</span>
          <ArrowTopRightOnSquareIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        </a>
      ) : (
        <div className="mt-0.5 font-mono text-xs leading-4 truncate">{row.requestId}</div>
      )}
    </div>
  );
}

/**
 * SECTION: Shared Director/Shareholder table
 * WHY: Keep all pages identical and read only from people.
 * INPUT: people rows + portal/org context + actions.
 * OUTPUT: merged table rows, CTOS fetch modal.
 * WHERE USED: Admin financial and organization detail pages.
 */
export function DirectorShareholderTable({
  people,
  directorShareholderListSource = null,
  ctosDirectorShareholderWarning = null,
  portal,
  organizationId,
  ctosFetchPendingKey,
  ctosFetchPending,
  subjectCtosReports,
  onFetchSubjectCtos,
  canManageCtos = true,
  ctosViewReportApplicationId,
}: {
  people: ApplicationPersonRow[];
  directorShareholderListSource?: DirectorShareholderListSource | null;
  ctosDirectorShareholderWarning?: string | null;
  portal: "issuer" | "investor";
  organizationId: string;
  ctosFetchPendingKey?: string | null;
  ctosFetchPending?: boolean;
  /** Latest CTOS report per party (matches `subject_ref` from API to IC/SSM). */
  subjectCtosReports?: CtosSubjectReportListItem[] | null;
  onFetchSubjectCtos?: (person: ApplicationPersonRow) => void;
  canManageCtos?: boolean;
  /** When set, View report uses application-scoped CTOS HTML route (financial review). */
  ctosViewReportApplicationId?: string;
}) {
  const { getAccessToken } = useAuthToken();
  const [pendingCtosSubjectFetch, setPendingCtosSubjectFetch] = React.useState<PendingCtosSubjectFetch | null>(null);
  const rows = React.useMemo(() => mergePeopleRowsByMatchKey(filterVisiblePeopleRows(people ?? [])), [people]);
  const verifiedRows = React.useMemo(
    () => rows.filter((p) => !isMissingGovernmentIdPerson(p)),
    [rows]
  );
  const unresolvedRows = React.useMemo(
    () => rows.filter((p) => isMissingGovernmentIdPerson(p)),
    [rows]
  );
  const resolvedCtosEmptyWarning = React.useMemo(
    () =>
      resolveDirectorShareholderCtosEmptyWarning({
        directorShareholderListSource,
        ctosDirectorShareholderWarning,
      }),
    [directorShareholderListSource, ctosDirectorShareholderWarning]
  );

  /** Same flow as {@link OrganizationIssuerCtosReportsCard}: fetch HTML first, then `window.open("", "_blank")` (no `noopener`) + `document.write`. */
  const openSubjectReportHtml = React.useCallback(
    async (reportId: string) => {
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not signed in");
        return;
      }
      const url = ctosViewReportApplicationId
        ? `${API_URL}/v1/admin/applications/${encodeURIComponent(ctosViewReportApplicationId)}/ctos-reports/${reportId}/html`
        : `${API_URL}/v1/admin/organizations/${portal}/${encodeURIComponent(organizationId)}/ctos-reports/${reportId}/html`;
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
    [getAccessToken, organizationId, portal, ctosViewReportApplicationId]
  );

  if (verifiedRows.length === 0 && unresolvedRows.length === 0) {
    return (
      <div className="space-y-3">
        {resolvedCtosEmptyWarning ? (
          <DirectorShareholderCtosEmptyAlert message={resolvedCtosEmptyWarning} />
        ) : null}
        <p className="text-sm text-muted-foreground py-4 text-center">
          {resolvedCtosEmptyWarning
            ? "No director or shareholder data is available from CTOS."
            : "No director or shareholder data."}
        </p>
      </div>
    );
  }

  return (
    <>
      {verifiedRows.length > 0 ? (
      <div className="overflow-hidden rounded-xl border">
      <div className="min-w-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[11.5rem] w-[13rem]">Name</TableHead>
              <TableHead className="min-w-[11.5rem] w-[13rem]">Roles</TableHead>
              <TableHead className="w-[5.5rem] whitespace-nowrap">Share %</TableHead>
              <TableHead className="w-[10.5rem] whitespace-nowrap">Status</TableHead>
              <TableHead className="w-[11rem] whitespace-nowrap">RegTank</TableHead>
              <TableHead className="w-[15rem] whitespace-nowrap" title="Fetch or view the CTOS report for this person.">
                CTOS
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {verifiedRows.map((p) => {
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
                <TableRow key={p.matchKey} className="odd:bg-muted/40 hover:bg-muted">
                  <TableCell className="align-top min-w-[11.5rem] w-[13rem] max-w-[14rem]">
                    <div className="font-medium">{p.name ?? "—"}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-0.5 whitespace-nowrap">{p.matchKey}</div>
                  </TableCell>
                  <TableCell className="align-top min-w-[11.5rem] w-[13rem] max-w-[14rem]">
                    {formatRoleTitleCaseWithoutShare(p)}
                  </TableCell>
                  <TableCell className="align-top w-[5.5rem] whitespace-nowrap tabular-nums">{shareDisplay}</TableCell>
                  <TableCell className="align-top w-[10.5rem] whitespace-nowrap">
                    <StatusBadge
                      label={finalStatus.label}
                      status={finalStatusToneToToken(finalStatus.tone)}
                      className="text-xs whitespace-nowrap"
                    />
                  </TableCell>
                  <TableCell className="align-top w-[11rem] whitespace-nowrap">
                    <RegtankColumnCell person={p} />
                  </TableCell>
                  <TableCell className="align-top w-[15rem] whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 px-2.5 text-xs shrink-0"
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
                          !canManageCtos ||
                          !onFetchSubjectCtos ||
                          (ctosFetchPending === true &&
                          ctosFetchPendingKey === normalizeDirectorShareholderIdKey(p.matchKey))
                        }
                        title={
                          !canManageCtos
                            ? "You do not have permission to perform this action."
                            : undefined
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
                        className="h-7 px-2.5 text-xs shrink-0"
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
                        View report
                      </Button>
                    </div>
                      <div className="text-[11px] text-muted-foreground">
                        {latestReport?.fetched_at
                          ? `Last fetched: ${
                              (() => {
                                try {
                                  return format(new Date(latestReport.fetched_at), "PPp");
                                } catch {
                                  return latestReport.fetched_at;
                                }
                              })()
                            }`
                          : "Last fetched: —"}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      </div>
      ) : null}
      {unresolvedRows.length > 0 ? (
        <div className={verifiedRows.length > 0 ? "mt-4" : undefined}>
          <DirectorShareholderUnresolvedIdentitySection
            people={unresolvedRows.map((p) => ({
              name: p.name,
              role: formatPeopleRolesLine(p),
              sharePercentage: p.sharePercentage,
              eodRequestId: p.requestId,
              onboardingStatus: p.onboarding?.status ?? null,
              amlStatus: p.screening?.status ?? null,
              kycId: p.onboarding?.id ?? null,
            }))}
          />
        </div>
      ) : null}

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
  const unresolved: ApplicationPersonRow[] = [];
  for (const row of rows) {
    if (isMissingGovernmentIdPerson(row)) {
      unresolved.push(row);
      continue;
    }
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
      directorEodRequestId: prev.directorEodRequestId || row.directorEodRequestId || null,
      shareholderEodRequestId: prev.shareholderEodRequestId || row.shareholderEodRequestId || null,
      partyCorporateRequestId: prev.partyCorporateRequestId || row.partyCorporateRequestId || null,
      parentCorporateRequestId: prev.parentCorporateRequestId || row.parentCorporateRequestId || null,
      screeningRequestId: prev.screeningRequestId || row.screeningRequestId || null,
      icFrontUrl: prev.icFrontUrl ?? row.icFrontUrl ?? null,
      icBackUrl: prev.icBackUrl ?? row.icBackUrl ?? null,
      email: prev.email ?? row.email ?? "",
    });
  }
  return [...Array.from(map.values()), ...unresolved];
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
