import * as React from "react";
import Link from "next/link";
import { formatCurrency } from "@cashsouk/config";
import { formatInvoiceReference, type AdminContractNoteSummary } from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolveContractNoteStatusBadge } from "@/contracts/utils/contract-note-status";
import { adminActionRowClass } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";

export function ContractNotesTable({ notes }: { notes: AdminContractNoteSummary[] }) {
  if (notes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-4">
        <p className="text-ui font-medium">No drawdowns yet</p>
        <p className="mt-1 text-meta text-muted-foreground">
          Each note issued from an approved invoice is a drawdown on this facility. Amounts come
          from the note target, the same figure that updates utilized facility.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Note</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Financing / allocation</TableHead>
          <TableHead className="hidden md:table-cell">Source invoice</TableHead>
          <TableHead className="text-right">Open</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {notes.map((note) => {
          const status = resolveContractNoteStatusBadge(note);
          const sourceInvoiceLabel = note.sourceInvoiceId
            ? formatInvoiceReference({
                displayReference: note.sourceInvoiceDisplayReference,
                id: note.sourceInvoiceId,
              })
            : null;
          return (
            <TableRow
              key={note.id}
              className={cn(
                "odd:bg-muted/40 hover:bg-muted",
                adminActionRowClass(status.token)
              )}
            >
              <TableCell className="font-mono text-meta font-medium">
                {note.noteReference}
              </TableCell>
              <TableCell className="min-w-0 max-w-[18rem]">
                <span className="block truncate font-medium" title={note.title}>
                  {note.title}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge label={status.label} status={status.token} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <p className="font-medium">{formatCurrency(note.targetAmount)}</p>
                {note.fundedAmount > 0 && note.fundedAmount !== note.targetAmount ? (
                  <p className="text-meta text-muted-foreground">
                    Funded {formatCurrency(note.fundedAmount)}
                  </p>
                ) : null}
                {note.invoiceFaceAmount != null ? (
                  <p className="text-meta text-muted-foreground">
                    Invoice face {formatCurrency(note.invoiceFaceAmount)}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="hidden max-w-[14rem] md:table-cell">
                {sourceInvoiceLabel ? (
                  <span
                    className="block truncate font-mono text-meta text-muted-foreground"
                    title={sourceInvoiceLabel}
                  >
                    {sourceInvoiceLabel}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/notes/${encodeURIComponent(note.id)}`}>View</Link>
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
