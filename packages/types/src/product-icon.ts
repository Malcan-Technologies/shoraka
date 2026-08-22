export type ProductIconKind = "receivable" | "facility" | "generic";

const PRODUCT_IMAGE_KEY_PREFIX = "products/";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function productImageS3Key(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return key.startsWith(PRODUCT_IMAGE_KEY_PREFIX) ? key : null;
}

function productImageS3KeyFromConfig(config: Record<string, unknown> | null): string | null {
  if (!config) return null;
  const image = asRecord(config.image);
  return (
    productImageS3Key(image?.s3_key) ??
    productImageS3Key(config.s3_key) ??
    productImageS3Key(config.image_s3_key)
  );
}

/** Catalog image uploaded on the financing-type workflow step. */
export function resolveProductImageS3KeyFromWorkflow(workflow: unknown): string | null {
  if (!Array.isArray(workflow)) return null;
  const steps = workflow.filter((step) => asRecord(step) != null);
  const financingType = steps.find((step) => {
    const record = asRecord(step);
    if (!record) return false;
    const id = typeof record.id === "string" ? record.id : "";
    const name = typeof record.name === "string" ? record.name : "";
    return id.startsWith("financing_type") || name.toLowerCase().includes("financing type");
  });
  const chosen = financingType ?? steps[0];
  return productImageS3KeyFromConfig(asRecord(asRecord(chosen)?.config));
}

/** Frozen note/application snapshot, including `image.s3_key` copied from the workflow. */
export function resolveProductImageS3KeyFromSnapshot(snapshot: unknown): string | null {
  const record = asRecord(snapshot);
  if (!record) return null;
  return (
    productImageS3Key(record.image_s3_key) ??
    productImageS3KeyFromConfig(record) ??
    productImageS3KeyFromConfig(asRecord(record.image))
  );
}

function normalizeProductLabel(value?: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

/**
 * Pick a card icon from the catalog product name or workflow category.
 * AR / invoice products share the receivable icon; facility products use the stack.
 */
export function resolveProductIconKind(
  productName?: string | null,
  productCategory?: string | null
): ProductIconKind {
  const blob = `${normalizeProductLabel(productName)} ${normalizeProductLabel(productCategory)}`;
  if (/\b(receivable|invoice|arf)\b/.test(blob) || /\(ar\)/.test(blob) || /\barf i\b/.test(blob)) {
    return "receivable";
  }
  if (/\b(facility|contract)\b/.test(blob)) {
    return "facility";
  }
  return "generic";
}
