import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

export function InvoiceDetailsSkeleton() {
  return (
    <div className="space-y-10 px-3 max-w-[1200px] mx-auto">
      {/* Contract Section */}
      <div className="space-y-4">
        <div>
          <Skeleton className="h-7 w-24" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="space-y-3 mt-4 px-3">
          <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-48" />

            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-40" />

            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-40" />

            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-40" />

            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-40" />

            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-40" />
          </div>
        </div>
      </div>

      {/* Invoices Section */}
      <div className="space-y-4">
        <div>
          <Skeleton className="h-7 w-24" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <Skeleton className="h-5 w-full" />

        <div className="border rounded-xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="w-[140px] text-xs font-semibold">
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                  <TableHead className="w-[100px] text-xs font-semibold">
                    <Skeleton className="h-4 w-12" />
                  </TableHead>
                  <TableHead className="w-[150px] text-xs font-semibold">
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                  <TableHead className="w-[150px] text-xs font-semibold">
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                  <TableHead className="w-[130px] text-xs font-semibold">
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                  <TableHead className="w-[200px] text-xs font-semibold">
                    <Skeleton className="h-4 w-28" />
                  </TableHead>
                  <TableHead className="w-[160px] text-xs font-semibold">
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {/* Row 1 */}
                <TableRow className="hover:bg-muted/40">
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-6 w-16" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-6 w-24" />
                  </TableCell>
                  <TableCell />
                </TableRow>

                {/* Row 2 */}
                <TableRow className="hover:bg-muted/40">
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-6 w-16" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-6 w-24" />
                  </TableCell>
                  <TableCell />
                </TableRow>

                {/* Row 3 */}
                <TableRow className="hover:bg-muted/40">
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-6 w-16" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="p-2">
                    <Skeleton className="h-6 w-24" />
                  </TableCell>
                  <TableCell />
                </TableRow>

                {/* Total Row */}
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
