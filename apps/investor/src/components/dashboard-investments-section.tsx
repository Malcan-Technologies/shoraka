"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInvestorInvestments } from "@/investments/hooks/use-marketplace-notes";
import {
  getInvestmentStatusLabel,
  sortInvestorInvestments,
} from "@/investments/sort-investments";
import { InvestmentPositionCard } from "@/investments/components/investment-position-card";

export function DashboardInvestmentsSection() {
  return <InvestorInvestmentsList limit={3} showViewAllButton />;
}

type InvestorInvestmentsListProps = {
  limit?: number;
  showViewAllButton?: boolean;
  showStatusFilter?: boolean;
};

type StatusFilterValue = "all" | "Pending confirmation" | "Active" | "In progress" | "Settled";

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilterValue; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "Pending confirmation", label: "Pending confirmation" },
  { value: "Active", label: "Active" },
  { value: "In progress", label: "In progress" },
  { value: "Settled", label: "Settled" },
];

export function InvestorInvestmentsList({
  limit,
  showViewAllButton = false,
  showStatusFilter = false,
}: InvestorInvestmentsListProps) {
  const { data, isLoading, error } = useInvestorInvestments();
  const notes = data?.notes ?? [];
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");

  const sortedNotes = useMemo(() => sortInvestorInvestments(notes, "most_relevant"), [notes]);
  const filteredNotes = useMemo(
    () =>
      sortedNotes.filter((note) =>
        statusFilter === "all" ? true : getInvestmentStatusLabel(note) === statusFilter
      ),
    [sortedNotes, statusFilter]
  );
  const visibleNotes = typeof limit === "number" ? filteredNotes.slice(0, limit) : filteredNotes;
  const activeStatusFilterCount = statusFilter === "all" ? 0 : 1;
  const hasFilters = activeStatusFilterCount > 0;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col items-start justify-between gap-3 pb-2 sm:flex-row sm:items-center">
        <CardTitle className="text-xl font-semibold">Investments</CardTitle>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
          {showStatusFilter ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <FunnelIcon className="h-4 w-4" />
                  Filters
                  {activeStatusFilterCount > 0 ? (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shadow-none bg-primary text-primary-foreground"
                    >
                      {activeStatusFilterCount}
                    </Badge>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    className="pl-8 relative cursor-pointer focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                    onClick={() => setStatusFilter(option.value)}
                  >
                    {statusFilter === option.value ? (
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <span className="h-2 w-2 rounded-full bg-foreground" />
                      </span>
                    ) : null}
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {showStatusFilter && hasFilters ? (
            <Button
              variant="ghost"
              onClick={() => setStatusFilter("all")}
              className="gap-2 h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <XMarkIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          ) : null}
          {showViewAllButton ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/investments" className="inline-flex items-center gap-2">
                View all
              </Link>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            Loading your investments...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load investments."}
          </div>
        ) : null}

        {!isLoading && !error && notes.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="text-[17px] leading-7 text-muted-foreground">
              You have not invested in any notes yet. Explore marketplace opportunities to start
              building your portfolio.
            </p>
          </div>
        ) : null}

        {!isLoading && !error ? (
          <div className="grid gap-3">
            {visibleNotes.map((note) => (
              <InvestmentPositionCard key={note.id} note={note} />
            ))}
          </div>
        ) : null}

        {!isLoading && !error && notes.length > 0 && visibleNotes.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            No investments found for the selected status.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
