"use client";

import * as React from "react";
import { BookOpenIcon } from "@heroicons/react/24/outline";
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
    className: value > 0 ? "text-status-success-text" : "text-foreground",
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
        {Array.from({ length: 3 }).map((_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-28" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-48" />
            </TableCell>
            {LEDGER_BUCKET_COLUMNS.map((column) => (
              <TableCell key={column.code}>
                <Skeleton className="ml-auto h-4 w-16" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function LedgerPanel({ note }: { note: NoteDetail }) {
  const { data: entries = [], isLoading } = useNoteLedger(note.id);
  const bucketTotals = React.useMemo(() => buildBucketTotals(entries), [entries]);
  const entryCount = entries.length;

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
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <BookOpenIcon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle>Ledger</CardTitle>
            <p className="mt-0.5 text-meta text-muted-foreground">
              {isLoading
                ? "Loading…"
                : entryCount === 0
                  ? "No ledger entries posted yet"
                  : `${entryCount} ${entryCount === 1 ? "entry" : "entries"}`}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={entryCount === 0}>
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="w-full overflow-x-auto">
            <LedgerTableSkeleton />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-32">Posted</TableHead>
                  <TableHead className="min-w-48">Description</TableHead>
                  {LEDGER_BUCKET_COLUMNS.map((column) => (
                    <TableHead
                      key={column.code}
                      className="min-w-[5.75rem] text-right"
                      title={column.label}
                    >
                      {column.shortLabel}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entryCount === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2 + LEDGER_BUCKET_COLUMNS.length}
                      className="py-8 text-center text-ui text-muted-foreground"
                    >
                      Ledger postings for this note will appear here.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(entry.postedAt)}
                        </TableCell>
                        <TableCell className="max-w-xs leading-snug">{entry.description}</TableCell>
                        {LEDGER_BUCKET_COLUMNS.map((column) => {
                          const signed =
                            entry.accountCode === column.code ? signedBucketAmount(entry) : null;
                          const formatted = formatSignedLedgerAmount(signed);
                          return (
                            <TableCell
                              key={column.code}
                              className={cn(
                                "text-right font-mono tabular-nums",
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
                      <TableCell colSpan={2} className="font-semibold text-foreground">
                        Net (this note)
                      </TableCell>
                      {LEDGER_BUCKET_COLUMNS.map((column) => {
                        const formatted = formatSignedLedgerAmount(bucketTotals[column.code]);
                        return (
                          <TableCell
                            key={column.code}
                            className={cn(
                              "text-right font-mono tabular-nums",
                              formatted.className
                            )}
                          >
                            {formatted.display}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
