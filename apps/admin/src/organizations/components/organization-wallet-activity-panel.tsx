"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
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
import { useOrganizationWalletActivity } from "@/organizations/hooks/use-organization-wallet-activity";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";
import { adminActionRowClass, getAdminStatusToken } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import {
  mapWalletActivityRows,
  type WalletActivityContext,
  type WalletActivityRow,
} from "./organization-wallet-activity";

const PAGE_SIZE = 20;

function signedAmount(direction: "IN" | "OUT", amount: number): string {
  const sign = direction === "IN" ? "+" : "-";
  return `${sign}${formatCurrency(amount)}`;
}

function WalletActivityContextCell({ context }: { context: WalletActivityContext }) {
  if (context.kind === "empty") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (context.kind === "text") {
    return <span className="text-muted-foreground">{context.text}</span>;
  }
  return (
    <span className="text-muted-foreground">
      {context.prefix ? <span>{context.prefix}</span> : null}
      <Link href={`/notes/${context.noteId}`} className="hover:text-primary hover:underline">
        {context.noteReferenceDisplay}
      </Link>
    </span>
  );
}

function WalletActivityRowView({ row }: { row: WalletActivityRow }) {
  const token = row.status ? getAdminStatusToken(row.status.tokenStatus) : "neutral";
  return (
    <TableRow className={cn("odd:bg-muted/40 hover:bg-muted", adminActionRowClass(token))}>
      <TableCell className="min-w-[220px]">
        <div className="font-medium">{row.title}</div>
        <div className="mt-0.5 text-meta">
          <WalletActivityContextCell context={row.context} />
        </div>
      </TableCell>
      <TableCell>
        {row.status ? <StatusBadge label={row.status.label} status={token} /> : "—"}
      </TableCell>
      <TableCell
        className={cn(
          "whitespace-nowrap text-ui font-medium tabular-nums",
          row.direction === "IN" ? "text-emerald-700" : "text-destructive"
        )}
      >
        {signedAmount(row.direction, row.amount)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-ui tabular-nums">
        {formatCurrency(row.balance)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-ui text-muted-foreground">
        {format(new Date(row.postedAt), "dd MMM yyyy HH:mm")}
      </TableCell>
    </TableRow>
  );
}

export function OrganizationWalletActivityPanel({ organizationId }: { organizationId: string }) {
  const [page, setPage] = React.useState(1);
  const { data, isLoading, error } = useOrganizationWalletActivity(organizationId);
  const rows = React.useMemo(
    () => mapWalletActivityRows(data?.entries ?? [], Number(data?.summary.availableBalance ?? 0)),
    [data?.entries, data?.summary.availableBalance]
  );
  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, totalCount);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={BanknotesIcon}
        title="Wallet transactions"
        description={
          isLoading
            ? "Loading…"
            : totalCount === 0
              ? "Deposits, withdrawals, and investments for this investor."
              : `${totalCount} ${totalCount === 1 ? "transaction" : "transactions"}`
        }
      />
      <CardContent className="space-y-4 p-0 pb-4">
        {error ? (
          <div className="px-6 py-4 text-ui text-destructive">
            Failed to load wallet transactions:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto px-6">
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Transaction</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? Array.from({ length: 4 }).map((_, idx) => (
                          <TableRow key={idx}>
                            {Array.from({ length: 5 }).map((__, jdx) => (
                              <TableCell key={jdx}>
                                <Skeleton className="h-4 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : pageRows.length === 0
                        ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                                No wallet transactions yet.
                              </TableCell>
                            </TableRow>
                          )
                        : pageRows.map((row) => <WalletActivityRowView key={row.id} row={row} />)}
                  </TableBody>
                </Table>
              </div>
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
