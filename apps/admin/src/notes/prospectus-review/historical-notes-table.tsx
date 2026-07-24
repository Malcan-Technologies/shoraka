"use client";

import type { ProspectusHistoricalNotesAdminTable } from "@cashsouk/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  table: ProspectusHistoricalNotesAdminTable;
};

/** Read-only Historical Notes table — values from API only (no local calculation). */
export function ProspectusHistoricalNotesTable({ table }: Props) {
  if (table.rows.length === 0) {
    return (
      <div
        data-prospectus-historical-notes-empty
        className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
      >
        {table.emptyStateMessage ?? "No notes are available yet."}
      </div>
    );
  }

  return (
    <div
      data-prospectus-historical-notes-table
      className="min-w-0 max-w-full overflow-x-auto rounded-xl border"
    >
      <Table className="min-w-[48rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {table.headers.map((header) => (
              <TableHead
                key={header}
                className="whitespace-nowrap text-sm font-semibold text-foreground"
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row, index) => (
            <TableRow key={`${row.noteId}-${index}`}>
              <TableCell className="whitespace-nowrap font-mono text-xs">{row.noteId}</TableCell>
              <TableCell className="text-sm">{row.financingType}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">{row.amountRm}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">{row.tenure}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">{row.profitRate}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">{row.status}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">{row.repaymentDate}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
