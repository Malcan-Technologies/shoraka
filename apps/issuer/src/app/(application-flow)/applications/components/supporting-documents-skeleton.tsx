import { Skeleton } from "@/components/ui/skeleton";

export function SupportingDocumentsSkeleton() {
  return (
    <div className="space-y-6 px-3 w-full max-w-[1200px] mx-auto">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-background overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5 border-b border-border bg-muted/15">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="divide-y divide-border bg-background">
            {[0, 1].map((row) => (
              <div key={row} className="px-4 py-4 sm:px-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-6 w-[4.5rem] rounded-md" />
                </div>
                <div className="flex flex-col gap-2 max-w-md">
                  <Skeleton className="h-8 w-full rounded-xl" />
                </div>
                <Skeleton className="h-5 w-28" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
