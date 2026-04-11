"use client";

/**
 * SECTION: Issuer organization CTOS report history (admin)
 * WHY: List stored org-level CTOS fetches; fetch latest and open HTML per row
 * INPUT: portal + organization id
 * OUTPUT: Card in org detail sidebar with list + Get latest + View
 * WHERE USED: OrganizationDetailPage right column (issuer or investor)
 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import type { AdminCtosReportListItem, PortalType } from "@cashsouk/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ArrowTopRightOnSquareIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function sortOrgCtosReports(rows: AdminCtosReportListItem[]): AdminCtosReportListItem[] {
  const orgRows = rows.filter((r) => !r.subject_ref);
  return [...orgRows].sort(
    (a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
  );
}

export function OrganizationIssuerCtosReportsCard({
  organizationId,
  portal,
}: {
  organizationId: string;
  portal: Extract<PortalType, "issuer" | "investor">;
}) {
  const [getLatestConfirmOpen, setGetLatestConfirmOpen] = React.useState(false);
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

  const openOrgReportHtml = React.useCallback(
    async (reportId: string) => {
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not signed in");
        return;
      }
      const url = `${API_URL}/v1/admin/organizations/${portal}/${encodeURIComponent(organizationId)}/ctos-reports/${reportId}/html`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        toast.error("Could not load full report");
        return;
      }
      const html = await res.text();
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      }
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
      <Card className="rounded-2xl shrink-0 flex flex-col max-h-[min(50vh,28rem)]">
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-medium leading-snug">CTOS reports for this organization</CardTitle>
            <Button
              type="button"
              size="sm"
              className="shrink-0 gap-1.5 h-8"
              disabled={fetchCtosMutation.isPending || ctosQuery.isLoading}
              onClick={() => setGetLatestConfirmOpen(true)}
            >
              <DocumentTextIcon className="h-3.5 w-3.5" />
              {fetchCtosMutation.isPending ? "Loading…" : "Get latest"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-1 min-h-0 overflow-y-auto">
          {ctosQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : ctosQuery.isError ? (
            <p className="text-sm text-destructive">
              {(ctosQuery.error as Error)?.message ?? "Could not load CTOS."}
            </p>
          ) : orgCtosReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports yet. Click Get latest.</p>
          ) : (
            <ul className="space-y-2">
              {orgCtosReports.map((r, idx) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-border/60 pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-muted-foreground">
                      {new Date(r.fetched_at).toLocaleString("en-MY", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {idx === 0 ? (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Latest
                      </Badge>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 shrink-0"
                    disabled={!r.has_report_html}
                    onClick={() => void openOrgReportHtml(r.id)}
                  >
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                    View
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={getLatestConfirmOpen} onOpenChange={setGetLatestConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Request a new report from CTOS?</AlertDialogTitle>
            <AlertDialogDescription>
              This starts a new CTOS pull for this organization. Stored reports appear in the list above after a
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
