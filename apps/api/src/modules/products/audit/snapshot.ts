import type { Product } from "@prisma/client";
import { productNameFromWorkflow } from "./product-name";
import type { ProductScalarSnapshot } from "./diff";

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function productBaseId(product: { id: string; base_id?: string | null }): string {
  return product.base_id ?? product.id;
}

export function productIdentityFields(product: Product): {
  productName: string;
  baseId: string;
  version: number;
} {
  return {
    productName: productNameFromWorkflow(product.workflow),
    baseId: productBaseId(product),
    version: product.version,
  };
}

export function productScalarSnapshot(product: Product): ProductScalarSnapshot {
  return {
    productCode: product.product_code ?? null,
    marketplaceListingDurationDays: product.marketplace_listing_duration_days ?? null,
    serviceFeeRatePercent: toNumber(product.service_fee_rate_percent),
    defaultFacilityFeeRatePercent: toNumber(product.default_facility_fee_rate_percent),
    categoryDisplayOrder: product.category_display_order ?? null,
    productDisplayOrder: product.product_display_order ?? null,
  };
}

export function productStatusOf(product: Product): "ACTIVE" | "INACTIVE" | "DELETED" {
  if (product.status === "INACTIVE" || product.status === "DELETED") return product.status;
  return "ACTIVE";
}
