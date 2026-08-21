"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type {
  AdminInvestmentItem,
  GetAdminInvestmentsParams,
  NoteInvestmentStatus,
} from "@cashsouk/types";
import { formatCurrency } from "@cashsouk/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestmentsTable } from "@/investments/components/investments-table";
import { InvestmentsTableToolbar } from "@/investments/components/investments-table-toolbar";
import {
  adminInvestmentsKeys,
  useAdminInvestments,
} from "@/investments/hooks/use-admin-investments";
import { AdminPageHeader } from "@/components/admin-page-header";
import { RequirePermission } from "@/components/require-permission";

export default function InvestmentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [status, setStatus] = React.useState("ALL");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;

  const params = React.useMemo(() => {
    const next: GetAdminInvestmentsParams = { page: currentPage, pageSize };
    if (searchQuery) next.search = searchQuery;
    if (status !== "ALL") next.status = status as NoteInvestmentStatus;
    return next;
  }, [currentPage, pageSize, searchQuery, status]);

  const { data, isLoading, error } = useAdminInvestments(params);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, status]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatus("ALL");
    setCurrentPage(1);
  };

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: adminInvestmentsKeys.all });
  };

  const handleViewNote = (investment: AdminInvestmentItem) => {
    router.push(`/notes/${investment.noteId}`);
  };

  const investments = React.useMemo(() => data?.items ?? [], [data?.items]);
  const totalInvestments = data?.pagination.totalCount ?? 0;

  const summary = React.useMemo(() => {
    const totals = {
      total: 0,
      active: 0,
      activeAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
    };
    for (const inv of investments) {
      totals.total += inv.amount;
      if (inv.status === "COMMITTED" || inv.status === "CONFIRMED") {
        totals.active += 1;
        totals.activeAmount += inv.amount;
      } else if (inv.status === "SETTLED") {
        totals.settledAmount += inv.amount;
      } else if (inv.status === "RELEASED" || inv.status === "CANCELLED") {
        totals.releasedAmount += inv.amount;
      }
    }
    return totals;
  }, [investments]);

  return (
    <RequirePermission permission="investments.view">
      <>
      
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-6 px-2 py-8 md:px-4">
          <section className="space-y-4">
            <AdminPageHeader
              title="Investments"
              description="Every investor commitment across all notes — track confirmations, releases, and settlements in one place."
            />

            {error && (
              <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
                Error loading investments:{" "}
                {error instanceof Error ? error.message : "Unknown error"}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Investments on this page
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums">
                    {isLoading ? "—" : investments.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    of {totalInvestments} matching filter
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Committed + Confirmed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums">
                    {isLoading ? "—" : formatCurrency(summary.activeAmount)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {summary.active} active investment{summary.active === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Settled (this page)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums">
                    {isLoading ? "—" : formatCurrency(summary.settledAmount)}
                  </div>
                  <p className="text-xs text-muted-foreground">Principal returned at settlement</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Released or Cancelled
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums">
                    {isLoading ? "—" : formatCurrency(summary.releasedAmount)}
                  </div>
                  <p className="text-xs text-muted-foreground">Refunded back to investor balance</p>
                </CardContent>
              </Card>
            </div>

            <InvestmentsTableToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              status={status}
              onStatusChange={setStatus}
              onClearFilters={handleClearFilters}
              onRefresh={handleReload}
              totalCount={totalInvestments}
              isLoading={isLoading}
            />

            <InvestmentsTable
              investments={investments}
              loading={isLoading}
              currentPage={currentPage}
              pageSize={pageSize}
              totalInvestments={totalInvestments}
              onPageChange={setCurrentPage}
              onViewNote={handleViewNote}
            />
          </section>
        </div>
      </div>
      </>
    </RequirePermission>
  );
}
