import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import React from "react";

interface Props {
  showContractSection?: boolean;
  showInvoiceTable?: boolean;
}

export function InvoiceDetailsSkeleton({
  showContractSection = true,
  showInvoiceTable = true,
}: Props) {
  return (
    <div className="space-y-10 px-3 max-w-[1200px] mx-auto">

      {/* ================= Contract Section ================= */}
      {showContractSection && (
        <div className="space-y-4">
          <div>
            <Skeleton className="h-7 w-24" />
            <div className="mt-2 h-px bg-border" />
          </div>

          <div className="space-y-3 mt-4 px-3">
            <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <React.Fragment key={i}>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-40" />
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= Invoice Section ================= */}
      {showInvoiceTable && (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Skeleton className="h-7 w-40" />
              <div className="mt-1">
                <Skeleton className="h-4 w-[60%]" />
              </div>
            </div>

            <div className="shrink-0 ml-4">
              <Skeleton className="h-10 w-[140px] rounded-lg" />
            </div>
          </div>

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
      )}
    </div>
  );
}