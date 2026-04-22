"use client";

/**
 * SECTION: Organization CTOS report history (admin sidebar)
 * WHY: Match KYC card typography, padding (p-6 pt-0), and date format (PPpp)
 * INPUT: portal + organization id
 * OUTPUT: Collapsible card with view (eye icon) / download (PDF)
 * WHERE USED: OrganizationDetailPage (issuer or investor)
 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import { format } from "date-fns";
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
import { CTOS_CONFIRM, CTOS_UI } from "@/lib/ctos-ui-labels";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function sortOrgCtosReports(rows: AdminCtosReportListItem[]): AdminCtosReportListItem[] {
  const orgRows = rows.filter((r) => !r.subject_ref);
  return [...orgRows].sort(
    (a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
  );
}

function reportPdfFilename(fetchedAtIso: string, reportId: string): string {
  const d = new Date(fetchedAtIso);
  const stamp = Number.isNaN(d.getTime())
    ? "report"
    : d.toISOString().slice(0, 19).replace(/[T:]/g, "-");
  return `ctos-report-${stamp}-${reportId.slice(0, 8)}.pdf`;
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

  const downloadOrgReportPdf = React.useCallback(
    async (reportId: string, fetchedAt: string) => {
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not signed in");
        return;
      }
      const url = `${API_URL}/v1/admin/organizations/${portal}/${encodeURIComponent(organizationId)}/ctos-reports/${reportId}/pdf`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        toast.error("Could not download PDF");
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = reportPdfFilename(fetchedAt, reportId);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("Report download started.");
    },
    [getAccessToken, organizationId, portal]
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
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex flex-1 min-w-0 items-center gap-2 rounded-lg -ml-2 pl-2 pr-1 py-0.5 text-left",
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
                  <span className="text-sm font-medium flex items-center gap-2 min-w-0 leading-none">
                    <DocumentTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">CTOS Report History</span>
                    {!ctosQuery.isLoading && orgCtosReports.length > 0 ? (
                      <Badge variant="secondary" className="text-xs shrink-0 font-normal">
                        {orgCtosReports.length}
                      </Badge>
                    ) : null}
                  </span>
                </button>
              </CollapsibleTrigger>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 h-8"
                disabled={fetchCtosMutation.isPending || ctosQuery.isLoading}
                onClick={(e) => {
                  e.preventDefault();
                  setGetLatestConfirmOpen(true);
                }}
              >
                <ArrowPathIcon
                  className={cn("h-3.5 w-3.5", fetchCtosMutation.isPending && "animate-spin")}
                />
                {fetchCtosMutation.isPending ? CTOS_UI.fetching : CTOS_UI.fetchReport}
              </Button>
            </div>
          </CardHeader>

          <CollapsibleContent className="overflow-hidden">
            <CardContent className="p-6 pt-0">
              <div
                className={cn(
                  "max-h-[min(20rem,45vh)] overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]",
                  "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30"
                )}
              >
                {ctosQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
                ) : ctosQuery.isError ? (
                  <p className="text-sm text-destructive">
                    {(ctosQuery.error as Error)?.message ?? "Could not load CTOS."}
                  </p>
                ) : orgCtosReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No reports yet. Use {CTOS_UI.fetchReport} to pull from CTOS.
                  </p>
                ) : (
                  <ul className="space-y-4 text-sm">
                    {orgCtosReports.map((r, idx) => (
                      <li key={r.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground">Fetched</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm text-foreground">
                              {format(new Date(r.fetched_at), "PPpp")}
                            </div>
                            {idx === 0 ? (
                              <Badge variant="secondary" className="text-xs font-normal">
                                Latest
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            disabled={!r.has_report_html}
                            title="Open report in a new tab"
                            onClick={() => void openOrgReportHtml(r.id)}
                          >
                            <EyeIcon className="h-4 w-4" aria-hidden />
                            <span className="sr-only">View CTOS report</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            disabled={!r.has_report_html}
                            title="Download PDF"
                            onClick={() => void downloadOrgReportPdf(r.id, r.fetched_at)}
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
            <AlertDialogTitle>{CTOS_CONFIRM.title}</AlertDialogTitle>
            <AlertDialogDescription>{CTOS_CONFIRM.organizationDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" disabled={fetchCtosMutation.isPending}>
              {CTOS_CONFIRM.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "secondary" }), "rounded-lg")}
              disabled={fetchCtosMutation.isPending}
              onClick={() => onConfirmGetLatest()}
            >
              {CTOS_CONFIRM.primaryAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
