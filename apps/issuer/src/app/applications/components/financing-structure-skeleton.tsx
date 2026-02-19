import { Skeleton } from "@/components/ui/skeleton";

export function FinancingStructureSkeleton() {
  return (
    <div className="px-3">
      <div className="space-y-4">
        {/* Option 1 Card */}
        <div className="border border-border rounded-xl p-4 bg-card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <Skeleton className="h-5 w-5 rounded-full mt-1 shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Option 2 Card */}
        <div className="border border-border rounded-xl p-4 bg-card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <Skeleton className="h-5 w-5 rounded-full mt-1 shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-72 shrink-0" />
          </div>
        </div>

        {/* Option 3 Card */}
        <div className="border border-border rounded-xl p-4 bg-card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <Skeleton className="h-5 w-5 rounded-full mt-1 shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
