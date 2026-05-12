"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import type {
  AdminInvestmentItem,
  GetAdminInvestmentsParams,
  NoteInvestmentStatus,
} from "@cashsouk/types";
import { formatCurrency } from "@cashsouk/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { InvestmentsTable } from "@/investments/components/investments-table";
import { InvestmentsTableToolbar } from "@/investments/components/investments-table-toolbar";
import {
  adminInvestmentsKeys,
  useAdminInvestments,
} from "@/investments/hooks/use-admin-investments";

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
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Investments</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-8 px-2 py-8 md:px-4">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BanknotesIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Investments Registry</h2>
                <p className="text-sm text-muted-foreground">
                  Every investor commitment across all notes — track confirmations, releases, and
                  settlements in one place.
                </p>
              </div>
            </div>

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
              onReload={handleReload}
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
  );
}
