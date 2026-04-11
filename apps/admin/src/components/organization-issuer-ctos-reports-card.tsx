"use client";

/**
 * SECTION: Organization CTOS report history (admin sidebar)
 * WHY: Collapsible list + fetch latest; view or download HTML without pushing layout
 * INPUT: portal + organization id
 * OUTPUT: Card aligned with KYC card styling on org detail
 * WHERE USED: OrganizationDetailPage right column (issuer or investor)
 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import type { AdminCtosReportListItem, PortalType } from "@cashsouk/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        <Card className="rounded-2xl shrink-0 overflow-hidden">
          <CardHeader className="pb-3 space-y-0">
            <div className="flex items-center gap-2">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex flex-1 min-w-0 items-center gap-2 rounded-lg -ml-1 px-1 py-1.5 text-left",
                    "hover:bg-muted/50 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  )}
                >
                  <ChevronRightIcon
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      historyOpen && "rotate-90"
                    )}
                  />
                  <DocumentTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground truncate">CTOS report history</span>
                  {!ctosQuery.isLoading ? (
                    <Badge variant="secondary" className="text-xs font-normal shrink-0 tabular-nums">
                      {orgCtosReports.length}
                    </Badge>
                  ) : null}
                </button>
              </CollapsibleTrigger>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 h-8 rounded-lg"
                disabled={fetchCtosMutation.isPending || ctosQuery.isLoading}
                onClick={() => setGetLatestConfirmOpen(true)}
              >
                <DocumentTextIcon className="h-3.5 w-3.5" />
                {fetchCtosMutation.isPending ? "Loading…" : "Get latest"}
              </Button>
            </div>
          </CardHeader>

          <CollapsibleContent className="overflow-hidden">
            <CardContent className="pt-0 pb-4 px-6 border-t border-border/50">
              <div className="max-h-56 overflow-y-auto pr-1 -mr-1">
                {ctosQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground py-2">Loading…</p>
                ) : ctosQuery.isError ? (
                  <p className="text-sm text-destructive py-2">
                    {(ctosQuery.error as Error)?.message ?? "Could not load CTOS."}
                  </p>
                ) : orgCtosReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No reports yet. Use Get latest to fetch from CTOS.</p>
                ) : (
                  <ul className="space-y-1">
                    {orgCtosReports.map((r, idx) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center gap-2 py-2 border-b border-border/50 last:border-0 text-sm"
                      >
                        <div className="flex flex-1 min-w-0 flex-wrap items-center gap-2">
                          <span className="text-muted-foreground tabular-nums">
                            {new Date(r.fetched_at).toLocaleString("en-MY", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {idx === 0 ? (
                            <Badge variant="secondary" className="text-[10px] font-medium shrink-0 px-1.5 py-0">
                              Latest
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
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
