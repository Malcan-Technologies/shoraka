"use client";

/**
 * Skeleton shown while contract or invoice record is loading.
 * Prevents flash of content before redirect when status is not OFFER_SENT.
 */

import { Skeleton } from "@/components/ui/skeleton";

export function OfferSignSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
  );
}
