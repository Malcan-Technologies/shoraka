"use client";

import * as React from "react";
import { format } from "date-fns";
import { UsersIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import type { AdminInvestmentItem, NoteDetail } from "@cashsouk/types";
import { Skeleton, StatusBadge } from "@cashsouk/ui";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Card, CardContent } from "@/components/ui/card";
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
import { getAdminStatusToken, adminActionRowClass } from "@/lib/admin-status-token";

const PAGE_SIZE = 20;

const INVESTMENT_STATUS_LABEL: Record<string, string> = {
  COMMITTED: "Committed",
  CONFIRMED: "Confirmed",
  SETTLED: "Settled",
  RELEASED: "Released",
  CANCELLED: "Cancelled",
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
      <AdminDetailCardHeader
        icon={UsersIcon}
        title="Investors"
        description={
          isLoading
            ? "Loading…"
            : totalCount === 0
              ? "No investor commitments yet"
              : `${totalCount} investor${totalCount === 1 ? "" : "s"} · ${formatCurrency(note.fundedAmount)} funded`
        }
      />
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
                          <TableRow
                            key={investment.id}
                            className={adminActionRowClass(getAdminStatusToken(investment.status))}
                          >
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
                              <StatusBadge
                                label={INVESTMENT_STATUS_LABEL[investment.status] ?? investment.status}
                                status={getAdminStatusToken(investment.status)}
                              />
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
