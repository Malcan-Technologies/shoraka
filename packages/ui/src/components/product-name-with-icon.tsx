import type { ComponentType, SVGProps } from "react";
import {
  BanknotesIcon,
  DocumentTextIcon,
  RectangleStackIcon,
} from "@heroicons/react/24/outline";
import { resolveProductIconKind, type ProductIconKind } from "@cashsouk/types";
import { cn } from "../lib/utils";

const PRODUCT_ICONS: Record<
  ProductIconKind,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  receivable: DocumentTextIcon,
  facility: RectangleStackIcon,
  generic: BanknotesIcon,
};

function ProductImageThumb({
  src,
  alt,
  size,
}: {
  src: string;
  alt: string;
  size: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-input bg-muted shadow-sm",
        size === "md" ? "size-10" : "size-8"
      )}
    >
      {/* Signed S3 URL; not a configured Next image host. */}
      <img src={src} alt={alt} className="size-full object-contain" />
    </span>
  );
}

export function ProductNameWithIcon({
  name,
  category,
  imageUrl,
  empty = "\u2014",
  size = "md",
  className,
  iconClassName,
}: {
  name?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  empty?: string;
  size?: "sm" | "md";
  className?: string;
  iconClassName?: string;
}) {
  const label = name?.trim() || category?.trim() || "";
  const resolvedImageUrl = imageUrl?.trim() || null;
  if (!label && !resolvedImageUrl) {
    return <span className={cn("text-ui text-foreground", className)}>{empty}</span>;
  }

  const Icon = PRODUCT_ICONS[resolveProductIconKind(name, category)];
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2 text-ui leading-6 text-foreground",
        className
      )}
    >
      {resolvedImageUrl ? (
        <ProductImageThumb src={resolvedImageUrl} alt={label || "Product"} size={size} />
      ) : (
        <Icon
          className={cn("h-4 w-4 shrink-0 text-muted-foreground", iconClassName)}
          aria-hidden
        />
      )}
      {label ? (
        <span className="min-w-0 truncate" title={label}>
          {label}
        </span>
      ) : (
        <span className="text-muted-foreground">{empty}</span>
      )}
    </span>
  );
}
