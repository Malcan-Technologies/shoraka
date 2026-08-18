import * as React from "react";
import Link from "next/link";
import { StatusBadge } from "@cashsouk/ui";
import type { AdminContractNoteSummary } from "@cashsouk/types";
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
        <p className="text-ui font-medium">No notes yet</p>
        <p className="mt-1 text-meta text-muted-foreground">
          Notes are created from approved invoices on this contract&apos;s applications. Any note
          issued against this facility will be listed here.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">Note</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Source invoice</TableHead>
          <TableHead className="text-right pr-4">Open</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {notes.map((note) => {
          const status = resolveContractNoteStatusBadge(note);
          return (
            <TableRow
              key={note.id}
              className={cn(
                "odd:bg-muted/40 hover:bg-muted",
                adminActionRowClass(status.token)
              )}
            >
              <TableCell className="pl-4 font-mono text-meta font-medium">
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
              <TableCell className="hidden max-w-[14rem] md:table-cell">
                {note.sourceInvoiceId ? (
                  <span
                    className="block truncate font-mono text-meta text-muted-foreground"
                    title={note.sourceInvoiceId}
                  >
                    {note.sourceInvoiceId}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="pr-4 text-right">
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
