"use client";

import { useS3ViewUrl } from "@cashsouk/config";
import { ProductNameWithIcon } from "./product-name-with-icon";

/** Product name plus the catalog image from the application-wizard financing-type step. */
export function ProductCatalogName({
  imageS3Key,
  imageUrl,
  ...props
}: {
  name?: string | null;
  category?: string | null;
  imageS3Key?: string | null;
  imageUrl?: string | null;
  empty?: string;
  size?: "xs" | "sm" | "md";
  className?: string;
  iconClassName?: string;
}) {
  const { data: loadedImageUrl } = useS3ViewUrl(imageUrl ? null : imageS3Key ?? null);
  return (
    <ProductNameWithIcon
      {...props}
      imageUrl={imageUrl?.trim() || loadedImageUrl || null}
    />
  );
}
