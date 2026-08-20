"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingState, StatusBadge } from "@cashsouk/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "./utils";
import type { FacilityTransactionRow } from "./facility-transactions";

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "—";
  return format(new Date(parsed), "d MMM yyyy, h:mm a");
}

export function FacilityTransactionsPanel({
  rows,
  isLoading,
}: {
  rows: FacilityTransactionRow[];
  isLoading?: boolean;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">Transactions</CardTitle>
        <p className="text-ui leading-6 text-muted-foreground">
          Funding requests, approvals, offers, and disbursements for this facility.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState variant="list" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            message="Funding requests and approvals will appear here as invoices move through this facility."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-40">Date</TableHead>
                <TableHead className="min-w-48">Event</TableHead>
                <TableHead className="min-w-36">Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatWhen(row.at)}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{row.label}</p>
                    {row.description ? (
                      <p className="mt-0.5 text-meta leading-5 text-muted-foreground">
                        {row.description}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.href && row.referenceLabel ? (
                      <Link
                        href={row.href}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {row.referenceLabel}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{row.referenceLabel ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.amount != null ? formatMoney(row.amount) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge label={row.statusLabel} status={row.statusToken} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
