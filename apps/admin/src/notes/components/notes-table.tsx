import * as React from "react";
import type { EligibleNoteInvoice, NoteListItem } from "@cashsouk/types";
import { Skeleton } from "@cashsouk/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";
import { NotesTableRow } from "./notes-table-row";

interface NotesTableProps {
  notes: NoteListItem[];
  readyInvoices: EligibleNoteInvoice[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  totalNotes: number;
  creatingInvoiceId: string | null;
  onPageChange: (page: number) => void;
  onViewDetails: (note: NoteListItem) => void;
  onCreateNote: (invoice: EligibleNoteInvoice) => void;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={index}>
          {Array.from({ length: 10 }).map((__, cellIndex) => (
            <TableCell key={cellIndex}>
              <Skeleton className="h-5 w-24" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function NotesTable({
  notes,
  readyInvoices,
  loading,
  currentPage,
  pageSize,
  totalNotes,
  creatingInvoiceId,
  onPageChange,
  onViewDetails,
  onCreateNote,
}: NotesTableProps) {
  const totalPages = Math.ceil(totalNotes / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalNotes);
  const registryCount = notes.length + readyInvoices.length;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="w-full overflow-x-auto">
        <Table className="w-full table-fixed">
          <colgroup>
            <col className="w-[9%]" />
            <col className="w-[19%]" />
            <col className="w-[7%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="truncate">Reference</TableHead>
              <TableHead className="truncate">Note / Invoice</TableHead>
              <TableHead className="truncate">Risk</TableHead>
              <TableHead className="truncate">Paymaster</TableHead>
              <TableHead className="truncate">Target</TableHead>
              <TableHead className="truncate">Funding</TableHead>
              <TableHead className="truncate">Status</TableHead>
              <TableHead className="truncate">Settlement</TableHead>
              <TableHead className="truncate">Maturity</TableHead>
              <TableHead className="truncate">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : registryCount === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  No approved invoices or notes found
                </TableCell>
              </TableRow>
            ) : (
              <>
                {readyInvoices.map((invoice) => (
                  <NotesTableRow
                    key={invoice.invoiceId}
                    readyInvoice={invoice}
                    creatingInvoiceId={creatingInvoiceId}
                    onCreateNote={onCreateNote}
                  />
                ))}
                {notes.map((note) => (
                  <NotesTableRow key={note.id} note={note} onViewDetails={onViewDetails} />
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      {!loading && totalNotes > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={totalNotes}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

