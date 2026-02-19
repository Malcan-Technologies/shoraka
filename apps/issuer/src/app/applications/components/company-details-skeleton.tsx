import { Skeleton } from "@/components/ui/skeleton";

export function CompanyDetailsSkeleton() {
  return (
    <div className="space-y-10 px-3">
      {/* Company Info Section */}
      <div className="space-y-4">
        <div>
          <Skeleton className="h-7 w-32" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Address Section */}
      <div className="space-y-4">
        <div>
          <Skeleton className="h-7 w-20" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Directors & Shareholders Section */}
      <div className="space-y-4">
        <div>
          <Skeleton className="h-7 w-40" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Banking Details Section */}
      <div className="space-y-4">
        <div>
          <Skeleton className="h-7 w-32" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Contact Person Section */}
      <div className="space-y-4">
        <div>
          <Skeleton className="h-7 w-36" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-10 w-full" />

          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
