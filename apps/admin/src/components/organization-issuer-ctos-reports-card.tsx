"use client";

/**
 * SECTION: Organization CTOS report history (admin sidebar)
 * WHY: Matches Activity Timeline + KYC card patterns; collapsible; view/download HTML
 * INPUT: portal + organization id
 * OUTPUT: Card consistent with organization detail right column
 * WHERE USED: OrganizationDetailPage (issuer or investor)
 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import type { AdminCtosReportListItem, PortalType } from "@cashsouk/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { cn } from "@/lib/utils";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ChevronRightIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function sortOrgCtosReports(rows: AdminCtosReportListItem[]): AdminCtosReportListItem[] {
  const orgRows = rows.filter((r) => !r.subject_ref);
  return [...orgRows].sort(
    (a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
  );
}

function reportHtmlFilename(fetchedAtIso: string, reportId: string): string {
  const d = new Date(fetchedAtIso);
  const stamp = Number.isNaN(d.getTime())
    ? "report"
    : d.toISOString().slice(0, 19).replace(/[T:]/g, "-");
  return `ctos-report-${stamp}-${reportId.slice(0, 8)}.html`;
}

export function OrganizationIssuerCtosReportsCard({
  organizationId,
  portal,
}: {
  organizationId: string;
  portal: Extract<PortalType, "issuer" | "investor">;
}) {
  const [getLatestConfirmOpen, setGetLatestConfirmOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(true);
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();

  const ctosQuery = useQuery({
    queryKey: ["admin", "organization-ctos-reports", portal, organizationId],
    queryFn: async () => {
      const res = await apiClient.listAdminOrganizationCtosReports(portal, organizationId);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    enabled: Boolean(organizationId),
  });

  const fetchCtosMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.createAdminOrganizationCtosReport(portal, organizationId);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "organization-ctos-reports", portal, organizationId] });
      toast.success("CTOS report saved.");
    },
    onError: (e: Error) => {
      toast.error(e.message || "CTOS request failed");
    },
  });

  const orgCtosReports = React.useMemo(
    () => sortOrgCtosReports(ctosQuery.data ?? []),
    [ctosQuery.data]
  );

  const fetchReportHtml = React.useCallback(
    async (reportId: string) => {
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not signed in");
        return null;
      }
      const url = `${API_URL}/v1/admin/organizations/${portal}/${encodeURIComponent(organizationId)}/ctos-reports/${reportId}/html`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        toast.error("Could not load report");
        return null;
      }
      return res.text();
    },
    [getAccessToken, organizationId, portal]
  );

  const openOrgReportHtml = React.useCallback(
    async (reportId: string) => {
      const html = await fetchReportHtml(reportId);
      if (!html) return;
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    },
    [fetchReportHtml]
  );

  const downloadOrgReportHtml = React.useCallback(
    async (reportId: string, fetchedAt: string) => {
      console.log("Downloading CTOS report HTML:", reportId);
      const html = await fetchReportHtml(reportId);
      if (!html) return;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = reportHtmlFilename(fetchedAt, reportId);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("Report download started.");
    },
    [fetchReportHtml]
  );

  const onConfirmGetLatest = () => {
    const t = toast.loading("Fetching CTOS report…");
    fetchCtosMutation.mutate(undefined, {
      onSettled: () => toast.dismiss(t),
    });
  };

  return (
    <>
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <Card className="rounded-2xl flex flex-col shrink-0 overflow-hidden">
          <CardHeader className="pb-3 shrink-0 space-y-0">
            <div className="flex items-start justify-between gap-3">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex-1 min-w-0 text-left rounded-lg -ml-2 pl-2 pr-1 py-1",
                    "hover:bg-muted/50 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ChevronRightIcon
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                        historyOpen && "rotate-90"
                      )}
                    />
                    <DocumentTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground leading-snug">CTOS Report History</span>
                    {!ctosQuery.isLoading && orgCtosReports.length > 0 ? (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0 tabular-nums">
                        {orgCtosReports.length}
                      </Badge>
                    ) : null}
                  </div>
                </button>
              </CollapsibleTrigger>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 h-8 mt-0.5"
                disabled={fetchCtosMutation.isPending || ctosQuery.isLoading}
                onClick={(e) => {
                  e.preventDefault();
                  setGetLatestConfirmOpen(true);
                }}
              >
                <ArrowPathIcon
                  className={cn("h-3.5 w-3.5", fetchCtosMutation.isPending && "animate-spin")}
                />
                {fetchCtosMutation.isPending ? "Fetching…" : "Get latest"}
              </Button>
            </div>
          </CardHeader>

          <CollapsibleContent className="overflow-hidden">
            <CardContent className="flex-1 overflow-hidden pt-0 px-0 border-t border-border/60">
              <ScrollArea className="h-56">
                <div className="px-6 pb-4 pt-3">
                  {ctosQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
                  ) : ctosQuery.isError ? (
                    <p className="text-sm text-destructive py-2">
                      {(ctosQuery.error as Error)?.message ?? "Could not load CTOS."}
                    </p>
                  ) : orgCtosReports.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No reports yet. Use Get latest to pull from CTOS.
                    </p>
                  ) : (
                    <ul className="space-y-0 divide-y divide-border/60">
                      {orgCtosReports.map((r, idx) => (
                        <li key={r.id} className="flex items-center gap-2 py-3 first:pt-0 text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground">Fetched</div>
                            <div className="text-sm font-medium text-foreground mt-0.5 flex flex-wrap items-center gap-2">
                              <span className="tabular-nums">
                                {new Date(r.fetched_at).toLocaleString("en-MY", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {idx === 0 ? (
                                <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0 h-5">
                                  Latest
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0 self-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                              disabled={!r.has_report_html}
                              title="View in new tab"
                              onClick={() => void openOrgReportHtml(r.id)}
                            >
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                              <span className="sr-only">View report</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                              disabled={!r.has_report_html}
                              title="Download HTML"
                              onClick={() => void downloadOrgReportHtml(r.id, r.fetched_at)}
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              <span className="sr-only">Download report</span>
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <AlertDialog open={getLatestConfirmOpen} onOpenChange={setGetLatestConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Request a new report from CTOS?</AlertDialogTitle>
            <AlertDialogDescription>
              This starts a new CTOS pull for this organization. Stored reports appear in the history after a
              successful fetch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" disabled={fetchCtosMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "secondary" }), "rounded-lg")}
              disabled={fetchCtosMutation.isPending}
              onClick={() => onConfirmGetLatest()}
            >
              Get latest report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
