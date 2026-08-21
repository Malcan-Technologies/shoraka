"use client";

import type { ReactNode } from "react";
import { useS3ViewUrl } from "@cashsouk/config";
import { cn } from "../lib/utils";

export function ProductCatalogImage({
  imageS3Key,
  imageUrl,
  alt,
  size = "md",
  fallback,
  className,
}: {
  imageS3Key?: string | null;
  imageUrl?: string | null;
  alt?: string;
  size?: "md" | "lg";
  fallback?: ReactNode;
  className?: string;
}) {
  const { data: loadedImageUrl } = useS3ViewUrl(imageUrl ? null : imageS3Key ?? null);
  const src = imageUrl?.trim() || loadedImageUrl || null;
  if (!src) return fallback ?? null;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted",
        size === "lg" ? "size-14" : "size-11",
        className
      )}
    >
      <img src={src} alt={alt || ""} className="size-full object-contain" />
    </span>
  );
}
