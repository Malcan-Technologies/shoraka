 "use client";

import * as React from "react";
import Image from "next/image";
import { Skeleton } from "../../../../components/ui/skeleton";
import { useS3ViewUrl } from "../../../../hooks/use-s3";

/**
 * ProductImagePreview (admin) - shared UI pattern.
 *
 * Recommended upload size: 512x512px (1:1).
 */
export function ProductImagePreview({ s3Key, alt }: { s3Key?: string; alt?: string }) {
  const { data: imageUrl, isLoading } = useS3ViewUrl(s3Key || null);

  if (isLoading) {
    return <div className="w-14 h-14 rounded-xl border border-input bg-muted overflow-hidden flex items-center justify-center shrink-0"><Skeleton className="w-full h-full"/></div>;
  }

  if (!imageUrl) {
    return (
      <div className="w-14 h-14 rounded-xl border border-input bg-muted overflow-hidden flex items-center justify-center shrink-0" aria-hidden>
        <div className="w-10 h-10 rounded-md bg-muted" />
      </div>
    );
  }

  return (
    <div className="relative w-14 h-14 rounded-xl border border-input bg-muted overflow-hidden flex items-center justify-center shrink-0">
      <Image src={imageUrl} alt={alt || ""} width={56} height={56} className="object-contain" unoptimized />
    </div>
  );
}

