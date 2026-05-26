"use client";

import { formatCurrency } from "@cashsouk/config";
import type { NoteDetail } from "@cashsouk/types";
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
import { useIssuerNoteLedger } from "../hooks/use-issuer-notes";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function LedgerPanel({
  note,
  description = "Posted activity for this note.",
}: {
  note: NoteDetail;
  description?: string;
}) {
  const { data: entries = [], isLoading } = useIssuerNoteLedger(note.id);

  const handleExport = () => {
    const header = ["postedAt", "accountCode", "direction", "amount", "description", "idempotencyKey"];
    const rows = entries.map((entry) => [
      entry.postedAt,
      entry.accountCode,
      entry.direction,
      String(entry.amount),
      entry.description,
      entry.idempotencyKey,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${note.noteReference}-activity-records.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Activity records</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={entries.length === 0}>
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading activity records...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity records posted yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-36">Posted</TableHead>
                    <TableHead className="min-w-44">Category</TableHead>
                    <TableHead className="min-w-64">Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(entry.postedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{entry.accountName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{entry.accountCode}</div>
                      </TableCell>
                      <TableCell className="text-sm">{entry.description}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {entry.direction === "DEBIT" ? formatCurrency(entry.amount) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {entry.direction === "CREDIT" ? formatCurrency(entry.amount) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
