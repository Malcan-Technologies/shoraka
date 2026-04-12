/**
 * TEMP dev-only mock for /applications/new financing type step.
 * Set USE_MOCK_FINANCING_TYPE_CATALOG in new/page.tsx to false before shipping.
 *
 * Sorting (matches ProductList + API):
 * - Categories: lower category_display_order first; null counts as 999999; tie → category name A–Z.
 * - Inside a category: lower product_display_order first; null counts as 999999; tie → older created_at first (string compare).
 * - API list query also uses: ORDER BY COALESCE(category_display_order, 999999), COALESCE(product_display_order, 999999), created_at ASC
 */

/** Set to `true` locally to preview the financing list (mock data + search/show-more). Keep `false` in git. */
export const USE_MOCK_FINANCING_TYPE_CATALOG = false;

type MockProduct = {
  id: string;
  version: number;
  category_name: string;
  category_display_order: number | null;
  product_display_order: number | null;
  created_at: string;
  workflow: Array<{
    name: string;
    config: Record<string, unknown>;
  }>;
};

function buildMockProduct(p: {
  id: string;
  title: string;
  description: string;
  categoryName: string;
  categoryDisplayOrder: number | null;
  productDisplayOrder: number | null;
  createdAt: string;
}): MockProduct {
  return {
    id: p.id,
    version: 1,
    category_name: p.categoryName,
    category_display_order: p.categoryDisplayOrder,
    product_display_order: p.productDisplayOrder,
    created_at: p.createdAt,
    workflow: [
      {
        name: "Financing Type",
        config: {
          name: p.title,
          description: p.description,
          category: p.categoryName,
          category_display_order: p.categoryDisplayOrder,
          product_display_order: p.productDisplayOrder,
          image: { s3_key: "" },
        },
      },
    ],
  };
}

/**
 * Six categories (scroll the page — no pagination). Invoice + Asset-based have 11 and 10 items → “Show more”.
 */
export const MOCK_FINANCING_TYPE_PRODUCTS: MockProduct[] = (() => {
  const base = new Date("2024-01-15T00:00:00.000Z").getTime();
  let dayOffset = 0;
  const rows: MockProduct[] = [];

  const addCategory = (
    slug: string,
    label: string,
    catOrder: number,
    count: number,
    desc: string
  ) => {
    for (let i = 0; i < count; i++) {
      rows.push(
        buildMockProduct({
          id: `mock-fin-${slug}-${i}`,
          title: `${label} — option ${i + 1}`,
          description: desc,
          categoryName: label,
          categoryDisplayOrder: catOrder,
          productDisplayOrder: i,
          createdAt: new Date(base + dayOffset * 86400000).toISOString(),
        })
      );
      dayOffset++;
    }
  };

  addCategory("wc", "Working capital", 1, 4, "Four products; category order 1.");
  addCategory(
    "inv",
    "Invoice financing",
    2,
    11,
    "Eleven products → first 8 visible, then “Show more”."
  );
  addCategory("trade", "Trade finance", 3, 3, "Three products; category order 3.");
  addCategory(
    "asset",
    "Asset-based lending",
    4,
    10,
    "Ten products → “Show more” inside this accordion."
  );
  addCategory("islamic", "Islamic financing", 5, 5, "Five products; category order 5.");
  addCategory("equip", "Equipment leasing", 6, 4, "Four products; last category by order.");

  return rows;
})();
