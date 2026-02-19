"use client";

/** Imports
 *
 * What: Skeleton component for loading states matching step UI layout.
 * Why: All steps show loading; use canonical skeleton to match final UI.
 * Data: Configurable rows, table option for different section types.
 */
import { Skeleton } from "@/components/ui/skeleton";

/**
 * STEP SKELETON
 *
 * What: Placeholder UI matching final step layout (labels + inputs).
 * Why: Consistent loading state across all steps.
 * Config:
 * - `rows`: number of form rows (default 3)
 * - `showTable`: if true, render a table skeleton instead of form rows
 * - `tableRows`: number of table rows (default 3)
 */
interface StepSkeletonProps {
  rows?: number;
  showTable?: boolean;
  tableRows?: number;
}

export function StepSkeleton({
  rows = 3,
  showTable = false,
  tableRows = 3,
}: StepSkeletonProps) {
  if (showTable) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Skeleton className="h-6 w-56" />
          <div className="mt-2 h-px bg-border" />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left">
                  <Skeleton className="h-4 w-24" />
                </th>
                <th className="px-4 py-3 text-left">
                  <Skeleton className="h-4 w-32" />
                </th>
                <th className="px-4 py-3 text-left">
                  <Skeleton className="h-4 w-28" />
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: tableRows }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-3">
                    <Skeleton className="h-5 w-20" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-5 w-28" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-5 w-24" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-6 w-56" />
        <div className="mt-2 h-px bg-border" />
      </div>

      {/* Form rows */}
      <div className="space-y-6">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-3 items-start"
          >
            {/* Label */}
            <Skeleton className="h-5 w-40" />
            {/* Input */}
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
