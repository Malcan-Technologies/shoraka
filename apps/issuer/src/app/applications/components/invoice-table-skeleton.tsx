"use client";

/** Invoice Table Skeleton
 *
 * What: Loading skeleton for the invoice table rows
 * Why: Allows table skeleton to be used separately from full invoice skeleton
 * Data: Shows 3 table rows + header
 */

import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

export function InvoiceTableSkeleton({ rowCount = 3 }: { rowCount?: number }) {
  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="table-fixed w-full">
          <TableHeader className="bg-muted/20">
            <TableRow>
              <TableHead className="w-[140px] whitespace-nowrap text-xs font-semibold">
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead className="w-[100px] whitespace-nowrap text-xs font-semibold">
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead className="w-[150px] whitespace-nowrap text-xs font-semibold">
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead className="flex-1 whitespace-nowrap text-xs font-semibold">
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead className="w-[140px] whitespace-nowrap text-xs font-semibold">
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead className="w-[100px] text-right pr-4">
                <Skeleton className="h-4 w-16 ml-auto" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowCount }).map((_, i) => (
              <TableRow key={i} className="border-b border-border hover:bg-muted/50">
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="text-right px-4 py-3">
                  <Skeleton className="h-4 w-20 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
