import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="space-y-10 px-3">
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

      {showInvoiceTable && (
        <div className="space-y-4">
          <div>
            <Skeleton className="h-7 w-40" />
            <div className="mt-1">
              <Skeleton className="h-4 w-[60%]" />
            </div>
            <div className="mt-2 h-px bg-border" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <React.Fragment key={i}>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-11 w-full" />
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
