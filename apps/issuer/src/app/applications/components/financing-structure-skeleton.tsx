import { Skeleton } from "@/components/ui/skeleton";

export function FinancingStructureSkeleton() {
  return (
    <div className="px-3">
      <div className="space-y-3">
        {/* Option 1 Card */}
        <div className="w-full rounded-xl border border-input bg-card px-4 py-3 min-h-[80px] flex items-center">
          <div className="flex w-full justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-48 rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Option 2 Card */}
        <div className="w-full rounded-xl border border-input bg-card px-4 py-3 min-h-[80px] flex items-center">
          <div className="flex w-full justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-48 rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                </div>
              </div>
            </div>
            <Skeleton className="h-10 w-72 shrink-0" />
          </div>
        </div>

        {/* Option 3 Card */}
        <div className="w-full rounded-xl border border-input bg-card px-4 py-3 min-h-[80px] flex items-center">
          <div className="flex w-full justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-48 rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
