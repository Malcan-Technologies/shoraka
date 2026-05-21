"use client";

import * as React from "react";
import { formatCurrency } from "@cashsouk/config";
import { Skeleton } from "@cashsouk/ui";
import type { NoteDetail, NoteLedgerEntry } from "@cashsouk/types";
import { NoteLedgerAccountType } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useNoteLedger } from "../hooks/use-note-detail";

const MONEY_TOLERANCE = 0.005;

const LEDGER_BUCKET_COLUMNS: Array<{
  code: NoteLedgerAccountType;
  label: string;
  shortLabel: string;
}> = [
  { code: NoteLedgerAccountType.INVESTOR_POOL, label: "Investor Pool", shortLabel: "Investor" },
  { code: NoteLedgerAccountType.REPAYMENT_POOL, label: "Repayment Pool", shortLabel: "Repayment" },
  {
    code: NoteLedgerAccountType.OPERATING_ACCOUNT,
    label: "Operating Account",
    shortLabel: "Operating",
  },
  { code: NoteLedgerAccountType.TAWIDH_ACCOUNT, label: "Ta'widh Account", shortLabel: "Ta'widh" },
  { code: NoteLedgerAccountType.GHARAMAH_ACCOUNT, label: "Gharamah Account", shortLabel: "Gharamah" },
  { code: NoteLedgerAccountType.ISSUER_PAYABLE, label: "Issuer Payable", shortLabel: "Issuer" },
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function signedBucketAmount(entry: NoteLedgerEntry) {
  return entry.direction === "CREDIT" ? entry.amount : -entry.amount;
}

function formatSignedLedgerAmount(value: number | null) {
  if (value == null || Math.abs(value) < MONEY_TOLERANCE) {
    return { display: "—", className: "text-muted-foreground/50" };
  }
  const prefix = value > 0 ? "+" : "−";
  return {
    display: `${prefix}${formatCurrency(Math.abs(value))}`,
    className: value > 0 ? "text-emerald-800 dark:text-emerald-300" : "text-foreground",
  };
}

function buildBucketTotals(entries: NoteLedgerEntry[]) {
  const totals = Object.fromEntries(
    LEDGER_BUCKET_COLUMNS.map((column) => [column.code, 0])
  ) as Record<NoteLedgerAccountType, number>;

  for (const entry of entries) {
    const code = entry.accountCode as NoteLedgerAccountType;
    if (code in totals) {
      totals[code] += signedBucketAmount(entry);
    }
  }
  return totals;
}

function LedgerTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-32">Posted</TableHead>
              <TableHead className="min-w-48">Description</TableHead>
              {LEDGER_BUCKET_COLUMNS.map((column) => (
                <TableHead key={column.code} className="min-w-[5.5rem] text-right">
                  <Skeleton className="ml-auto h-4 w-14" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-5 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-48" />
                </TableCell>
                {LEDGER_BUCKET_COLUMNS.map((column) => (
                  <TableCell key={column.code}>
                    <Skeleton className="ml-auto h-5 w-16" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function LedgerPanel({ note }: { note: NoteDetail }) {
  const { data: entries = [], isLoading } = useNoteLedger(note.id);
  const bucketTotals = React.useMemo(() => buildBucketTotals(entries), [entries]);

  const handleExport = () => {
    const header = [
      "postedAt",
      "description",
      ...LEDGER_BUCKET_COLUMNS.map((column) => column.code),
    ];
    const rows = entries.map((entry) => {
      const signedByBucket = Object.fromEntries(
        LEDGER_BUCKET_COLUMNS.map((column) => [
          column.code,
          entry.accountCode === column.code ? String(signedBucketAmount(entry)) : "",
        ])
      );
      return [
        entry.postedAt,
        entry.description,
        ...LEDGER_BUCKET_COLUMNS.map((column) => signedByBucket[column.code]),
      ];
    });
    const footer = [
      "",
      "NET",
      ...LEDGER_BUCKET_COLUMNS.map((column) => String(bucketTotals[column.code])),
    ];
    const csv = [header, ...rows, footer]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${note.noteReference}-ledger.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Ledger</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Platform buckets as columns. Each row is one posting: + adds to a bucket, − removes.
            Column nets are the running balance for this note.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={entries.length === 0}>
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LedgerTableSkeleton />
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ledger entries posted yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-32 text-xs">Posted</TableHead>
                    <TableHead className="min-w-48 text-xs">Description</TableHead>
                    {LEDGER_BUCKET_COLUMNS.map((column) => (
                      <TableHead
                        key={column.code}
                        className="min-w-[5.75rem] text-right"
                        title={column.label}
                      >
                        <span className="block text-xs font-semibold">{column.shortLabel}</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(entry.postedAt)}
                      </TableCell>
                      <TableCell className="max-w-xs text-xs leading-snug text-foreground">
                        {entry.description}
                      </TableCell>
                      {LEDGER_BUCKET_COLUMNS.map((column) => {
                        const signed =
                          entry.accountCode === column.code ? signedBucketAmount(entry) : null;
                        const formatted = formatSignedLedgerAmount(signed);
                        return (
                          <TableCell
                            key={column.code}
                            className={cn(
                              "text-right font-mono text-xs tabular-nums",
                              formatted.className
                            )}
                          >
                            {formatted.display}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-muted/40 font-semibold hover:bg-muted/40">
                    <TableCell colSpan={2} className="text-xs font-semibold text-foreground">
                      Net (this note)
                    </TableCell>
                    {LEDGER_BUCKET_COLUMNS.map((column) => {
                      const formatted = formatSignedLedgerAmount(bucketTotals[column.code]);
                      return (
                        <TableCell
                          key={column.code}
                          className={cn(
                            "text-right font-mono text-xs tabular-nums",
                            formatted.className
                          )}
                        >
                          {formatted.display}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
