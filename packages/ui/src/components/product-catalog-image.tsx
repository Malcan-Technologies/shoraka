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
    <img
      src={src}
      alt={alt || ""}
      className={cn(
        "shrink-0 object-contain",
        size === "lg" ? "size-14" : "size-11",
        className
      )}
    />
  );
}
