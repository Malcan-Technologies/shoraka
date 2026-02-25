import { Skeleton } from "@/components/ui/skeleton";

export function DeclarationsSkeleton() {
  return (
    <div className="px-3">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Declarations Box */}
        <div className="rounded-xl border border-border bg-background p-4 sm:p-5 h-fit">
          <div className="space-y-4">
            {/* Checkbox item 1 */}
            <label className="flex items-start gap-3 cursor-pointer">
              <Skeleton className="h-5 w-5 rounded mt-0.5 shrink-0" />
              <Skeleton className="h-6 w-full" />
            </label>

            {/* Checkbox item 2 */}
            <label className="flex items-start gap-3 cursor-pointer">
              <Skeleton className="h-5 w-5 rounded mt-0.5 shrink-0" />
              <Skeleton className="h-6 w-full" />
            </label>

            {/* Checkbox item 3 */}
            <label className="flex items-start gap-3 cursor-pointer">
              <Skeleton className="h-5 w-5 rounded mt-0.5 shrink-0" />
              <Skeleton className="h-12 w-full" />
            </label>
          </div>
        </div>

        {/* What Happens Next Section */}
        <div className="rounded-xl border border-border bg-background p-6">
          <Skeleton className="h-7 w-40" />
          <div className="mt-2 h-px bg-border" />

          <div className="mt-4 space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>

          <Skeleton className="h-12 w-full mt-5" />
        </div>
      </div>
    </div>
  );
}
