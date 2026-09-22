"use client";

import * as React from "react";
import { resolveNoteTimingDisplay, type EligibleNoteInvoice, type NoteListItem } from "@cashsouk/types";
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

const NOTES_TABLE_COLUMN_COUNT = 8;

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={index}>
          {Array.from({ length: NOTES_TABLE_COLUMN_COUNT }).map((__, cellIndex) => (
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
  return row.kind === "note"
    ? resolveNoteTimingDisplay(row.note).sortTime
    : timestampOrNull(row.invoice.maturityDate);
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
  const invoiceCount = readyInvoices.length;
  const invoicesOnThisPageCount = currentPage === 1 ? invoiceCount : 0;
  const totalEntries = totalNotes + invoiceCount;
  const notePages = Math.ceil(totalNotes / pageSize);
  const totalPages = notePages > 0 ? notePages : invoiceCount > 0 ? 1 : 0;
  const noteOffset = (currentPage - 1) * pageSize;
  const startIndex =
    totalEntries === 0 ? 0 : noteOffset + 1 + invoiceCount - invoicesOnThisPageCount;
  const endIndex = invoiceCount + Math.min(currentPage * pageSize, totalNotes);
  const registryRows = React.useMemo<NotesSortRow[]>(
    () => [
      ...(currentPage === 1
        ? readyInvoices.map((invoice) => ({
            key: invoice.invoiceId,
            kind: "invoice" as const,
            invoice,
          }))
        : []),
      ...notes.map((note) => ({
        key: note.id,
        kind: "note" as const,
        note,
      })),
    ],
    [currentPage, notes, readyInvoices]
  );
  const { sortedRows, sortColumn, sortDirection, onSort } = useTableSort(
    registryRows,
    notesSortValue
  );

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="w-full overflow-x-auto">
        <Table className="w-full min-w-[72rem] table-fixed">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="truncate">Note</TableHead>
              <TableHead className="truncate">Risk</TableHead>
              <SortableTableHead
                column="settlementAmt"
                label="Amount"
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
              <TableHead className="min-w-[13rem] truncate">Status</TableHead>
              <TableHead className="truncate" title="Settlement trustee instruction after posting">
                Trustee
              </TableHead>
              <SortableTableHead
                column="maturity"
                label="Maturity"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={onSort}
              />
              <TableHead className="text-center whitespace-nowrap last:pr-2">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : sortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={NOTES_TABLE_COLUMN_COUNT} className="py-10 text-center text-muted-foreground">
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
      {!loading && totalEntries > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={totalEntries}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
