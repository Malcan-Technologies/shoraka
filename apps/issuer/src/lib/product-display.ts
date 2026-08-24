import {
  resolveProductImageS3KeyFromWorkflow,
  type Product,
} from "@cashsouk/types";

type WorkflowStep = {
  name?: string;
  id?: string;
  config?: { name?: string };
};

export type ProductDisplay = {
  name: string;
  imageS3Key: string | null;
};

export function buildProductDisplayMap(products: Product[]): Map<string, ProductDisplay> {
  const map = new Map<string, ProductDisplay>();
  for (const product of products) {
    const workflow = (product.workflow ?? []) as WorkflowStep[];
    const financingStep = workflow.find(
      (step) =>
        String(step?.id ?? "").startsWith("financing_type") ||
        String(step?.name ?? "").toLowerCase().includes("financing type")
    );
    const name =
      financingStep?.config?.name ||
      workflow[0]?.config?.name ||
      (product as Product & { name?: string; title?: string }).name ||
      (product as Product & { name?: string; title?: string }).title ||
      `Product ${product.id}`;
    map.set(product.id, {
      name,
      imageS3Key: resolveProductImageS3KeyFromWorkflow(product.workflow),
    });
  }
  return map;
}

export function buildProductNameMap(products: Product[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const [id, display] of buildProductDisplayMap(products)) {
    names.set(id, display.name);
  }
  return names;
}

export function resolveProductDisplayName(product: Product | null | undefined): string | null {
  if (!product) return null;
  const name = buildProductDisplayMap([product]).get(product.id)?.name?.trim();
  return name && !name.startsWith("Product ") ? name : null;
}

/** Catalog name first, then any stored dashboard name. */
export function resolveIssuerProductDisplay(
  displayMap: Map<string, ProductDisplay>,
  productIds: Array<string | null | undefined>,
  fallbacks: Array<string | null | undefined> = []
): ProductDisplay {
  for (const id of productIds) {
    const display = id?.trim() ? displayMap.get(id.trim()) : undefined;
    const name = display?.name?.trim();
    if (name && !name.startsWith("Product ")) {
      return { name, imageS3Key: display?.imageS3Key ?? null };
    }
  }
  const fallback = fallbacks.map((value) => value?.trim()).find(Boolean) ?? "";
  return { name: fallback, imageS3Key: null };
}
