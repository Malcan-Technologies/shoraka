import { Skeleton } from "@/components/ui/skeleton";

export function ContractDetailsSkeleton() {
  return (
    <div className="space-y-10 px-3">
      {/* Contract Details Section */}
      <div className="space-y-4">
        <div>
          <Skeleton className="h-7 w-40" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-full" />

          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>

      {/* Customer Details Section */}
      <div className="space-y-4">
        <div>
          <Skeleton className="h-7 w-36" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
