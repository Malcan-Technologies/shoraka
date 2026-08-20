"use client";

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
import { SortableTableHead } from "@/shared/admin-list/components/sortable-table-head";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";
import { timestampOrNull } from "@/shared/admin-list/table-sort";
import { useTableSort } from "@/shared/admin-list/use-table-sort";
import { NotesTableRow } from "./notes-table-row";

type NotesSortColumn = "settlementAmt" | "funding" | "maturity";

type NotesSortRow =
  | { key: string; kind: "invoice"; invoice: EligibleNoteInvoice }
  | { key: string; kind: "note"; note: NoteListItem };

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
  canCreate?: boolean;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={index}>
          {Array.from({ length: 11 }).map((__, cellIndex) => (
            <TableCell key={cellIndex}>
              <Skeleton className="h-5 w-24" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function notesSortValue(row: NotesSortRow, column: NotesSortColumn): number | null {
  if (column === "settlementAmt") {
    return row.kind === "note" ? row.note.settlementAmount : row.invoice.invoiceAmount;
  }
  if (column === "funding") {
    return row.kind === "note" ? row.note.fundingPercent : null;
  }
  return timestampOrNull(row.kind === "note" ? row.note.maturityDate : row.invoice.maturityDate);
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
  canCreate,
}: NotesTableProps) {
  const totalPages = Math.ceil(totalNotes / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalNotes);
  const registryRows = React.useMemo<NotesSortRow[]>(
    () => [
      ...readyInvoices.map((invoice) => ({
        key: invoice.invoiceId,
        kind: "invoice" as const,
        invoice,
      })),
      ...notes.map((note) => ({
        key: note.id,
        kind: "note" as const,
        note,
      })),
    ],
    [notes, readyInvoices]
  );
  const { sortedRows, sortColumn, sortDirection, onSort } = useTableSort(
    registryRows,
    notesSortValue
  );

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="w-full overflow-x-auto">
        <Table className="w-full min-w-[80rem] table-fixed">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[11%]" />
            <col className="w-[6%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[14%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="truncate">Reference</TableHead>
              <TableHead className="truncate">Note / Invoice</TableHead>
              <TableHead className="truncate">Risk</TableHead>
              <TableHead className="truncate">Facility</TableHead>
              <SortableTableHead
                column="settlementAmt"
                label="Settlement amt"
                title="Invoice settlement amount"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={onSort}
              />
              <SortableTableHead
                column="funding"
                label="Funding"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={onSort}
              />
              <TableHead className="truncate">Status</TableHead>
              <TableHead className="truncate">Settlement</TableHead>
              <TableHead className="truncate" title="Settlement trustee instruction after posting">
                Trustee instruction
              </TableHead>
              <SortableTableHead
                column="maturity"
                label="Maturity"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={onSort}
              />
              <TableHead className="whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : sortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                  No approved invoices or notes found
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) =>
                row.kind === "invoice" ? (
                  <NotesTableRow
                    key={row.key}
                    readyInvoice={row.invoice}
                    creatingInvoiceId={creatingInvoiceId}
                    onCreateNote={onCreateNote}
                    canCreate={canCreate}
                  />
                ) : (
                  <NotesTableRow key={row.key} note={row.note} onViewDetails={onViewDetails} />
                )
              )
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
