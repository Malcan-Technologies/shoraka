/**
 * Product Audit display name. Same source as the Admin Products table and JSON export:
 * `metadata.workflow[0].config.name`, then `metadata.workflow[0].config.type.name`.
 *
 * Live writers snapshot workflow on PRODUCT_CREATED / PRODUCT_UPDATED / PRODUCT_DELETED.
 * PRODUCT_INACTIVATED / PRODUCT_REACTIVATED do not; those rows have no name here.
 */
export function productNameFromLogMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const workflow = Array.isArray(metadata?.workflow) ? metadata.workflow : [];
  const first = workflow[0] as
    | { config?: { name?: unknown; type?: { name?: unknown } } }
    | undefined;
  const fromConfig = readName(first?.config?.name);
  if (fromConfig) return fromConfig;
  return readName(first?.config?.type?.name);
}

function readName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
