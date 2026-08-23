"use client";

import { ProductCatalogName } from "@cashsouk/ui";

/** Catalog product image + name for admin entity headers. */
export function AdminProductIdentity({
  name,
  imageS3Key,
}: {
  name?: string | null;
  imageS3Key?: string | null;
}) {
  if (!name?.trim() && !imageS3Key?.trim()) return null;
  return <ProductCatalogName name={name} imageS3Key={imageS3Key} size="xs" />;
}
