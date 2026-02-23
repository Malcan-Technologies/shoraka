import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

export function ReviewInvoiceSkeleton() {
  return (
    <div className="px-3">
      <div className="space-y-4">
        {/* Keep only the table skeleton for Review page to reduce extra controls */}

        <div className="border rounded-xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader className="bg-muted/20">
                <TableRow>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <TableHead key={i} className="text-xs font-semibold">
                      <Skeleton className="h-4 w-20" />
                    </TableHead>
                  ))}
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {Array.from({ length: 3 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {Array.from({ length: 7 }).map((_, colIndex) => (
                      <TableCell key={colIndex} className="p-2">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                ))}

                <TableRow className="bg-muted/10">
                  <TableCell colSpan={5} />
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

