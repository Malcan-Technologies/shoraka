"use client";

import * as React from "react";
import { format } from "date-fns";
import { UsersIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import type { AdminInvestmentItem, NoteDetail } from "@cashsouk/types";
import { Skeleton } from "@cashsouk/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminInvestments } from "@/investments/hooks/use-admin-investments";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";

const PAGE_SIZE = 20;

const STATUS_TONE: Record<string, string> = {
  COMMITTED:
    "border-transparent bg-status-action-bg text-status-action-text dark:bg-amber-950/40 dark:text-amber-300",
  CONFIRMED:
    "border-transparent bg-status-completed-bg text-status-completed-text dark:bg-sky-950/40 dark:text-sky-300",
  SETTLED:
    "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300",
  RELEASED:
    "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
  CANCELLED:
    "border-transparent bg-status-rejected-bg text-status-rejected-text dark:bg-red-950/40 dark:text-red-300",
};

function formatDate(value: string | null): string {
  return value ? format(new Date(value), "dd MMM yyyy") : "—";
}

function getInvestorName(item: AdminInvestmentItem): string {
  return (
    item.investorOrganizationName ??
    item.investorUserName ??
    item.investorUserEmail ??
    item.investorUserId
  );
}

interface NoteInvestorsPanelProps {
  note: NoteDetail;
}

export function NoteInvestorsPanel({ note }: NoteInvestorsPanelProps) {
  const [page, setPage] = React.useState(1);
  const { data, isLoading, error } = useAdminInvestments({
    noteId: note.id,
    page,
    pageSize: PAGE_SIZE,
  });
  const items = data?.items ?? [];
  const totalCount = data?.pagination.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, totalCount);

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <UsersIcon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Investors</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isLoading
                ? "Loading…"
                : totalCount === 0
                  ? "No investor commitments yet"
                  : `${totalCount} investor${totalCount === 1 ? "" : "s"} · ${formatCurrency(note.fundedAmount)} funded`}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div className="px-5 py-4 text-sm text-destructive">
            Failed to load investors:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Allocation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Committed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 3 }).map((_, idx) => (
                        <TableRow key={idx}>
                          {Array.from({ length: 5 }).map((__, jdx) => (
                            <TableCell key={jdx}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : items.length === 0
                      ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                              Investors who commit to this note will appear here.
                            </TableCell>
                          </TableRow>
                        )
                      : items.map((investment) => (
                          <TableRow key={investment.id}>
                            <TableCell>
                              <div className="font-medium">{getInvestorName(investment)}</div>
                              {investment.investorUserName && investment.investorOrganizationName ? (
                                <div className="text-xs text-muted-foreground">
                                  {investment.investorUserName}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(investment.amount)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {investment.allocationPercent.toFixed(2)}%
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={STATUS_TONE[investment.status] ?? STATUS_TONE.RELEASED}
                              >
                                {investment.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(investment.committedAt)}
                              {investment.releasedAt ? (
                                <div className="text-xs text-muted-foreground">
                                  Released {formatDate(investment.releasedAt)}
                                </div>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
            </div>
            {!isLoading && totalCount > 0 ? (
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                startIndex={startIndex}
                endIndex={endIndex}
                totalItems={totalCount}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
