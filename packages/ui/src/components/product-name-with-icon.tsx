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
  size: "xs" | "sm" | "md";
}) {
  return (
    // Signed S3 URL; not a configured Next image host.
    <img
      src={src}
      alt={alt}
      className={cn(
        "shrink-0 object-contain",
        size === "md" ? "size-10" : size === "sm" ? "size-8" : "size-6"
      )}
    />
  );
}

export function ProductNameWithIcon({
  name,
  category,
  imageUrl,
  empty = "\u2014",
  size = "xs",
  className,
  iconClassName,
}: {
  name?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  empty?: string;
  size?: "xs" | "sm" | "md";
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
        "inline-flex min-w-0 items-center align-middle text-ui leading-6 text-foreground",
        size === "xs" ? "gap-1.5" : "gap-2",
        className
      )}
    >
      {resolvedImageUrl ? (
        <ProductImageThumb src={resolvedImageUrl} alt={label || "Product"} size={size} />
      ) : (
        <Icon
          className={cn(
            "shrink-0 text-muted-foreground",
            size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4",
            iconClassName
          )}
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
