import { Skeleton } from "@/components/ui/skeleton";

export function SupportingDocumentsSkeleton() {
  return (
    <div className="space-y-10 px-3">
      {/* Document Category 1 */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 px-3">
          <Skeleton className="h-5 w-32" />
          <div className="flex justify-end gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="w-px h-4 bg-border/60" />
            <Skeleton className="h-6 w-24" />
          </div>

          <Skeleton className="h-5 w-32" />
          <div className="flex justify-end gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="w-px h-4 bg-border/60" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </div>

      {/* Document Category 2 */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-6 w-36" />
            </div>
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 px-3">
          <Skeleton className="h-5 w-32" />
          <div className="flex justify-end gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="w-px h-4 bg-border/60" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </div>

      {/* Document Category 3 */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 px-3">
          <Skeleton className="h-5 w-28" />
          <div className="flex justify-end gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="w-px h-4 bg-border/60" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
