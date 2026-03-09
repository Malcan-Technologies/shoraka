 "use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useS3ViewUrl } from "@/hooks/use-s3";

/**
 * ProductImagePreview - shared UI pattern for product image preview.
 *
 * Recommended upload size: 512x512px (1:1).
 * Larger square images scale down cleanly.
 * Non-square images are contained without distortion.
 */
export function ProductImagePreview({
  s3Key,
  alt,
  forceBgWhite = false,
}: {
  s3Key?: string;
  alt?: string;
  forceBgWhite?: boolean;
}) {
  const { data: imageUrl, isLoading } = useS3ViewUrl(s3Key || null);

  const containerBg = forceBgWhite ? "bg-white" : "bg-muted";

  if (isLoading) {
    return (
      <div
        className={`w-14 h-14 rounded-xl border border-input ${containerBg} overflow-hidden flex items-center justify-center shrink-0`}
      >
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div
        className={`w-14 h-14 rounded-xl border border-input ${containerBg} overflow-hidden flex items-center justify-center shrink-0`}
        aria-hidden
      >
        <div className={`w-10 h-10 rounded-md ${forceBgWhite ? "bg-white" : "bg-muted"}`} />
      </div>
    );
  }

  return (
    <div className={`w-14 h-14 rounded-xl border border-input ${containerBg} overflow-hidden flex items-center justify-center shrink-0`}>
      <img src={imageUrl} alt={alt || ""} className="w-full h-full object-contain" />
    </div>
  );
}

