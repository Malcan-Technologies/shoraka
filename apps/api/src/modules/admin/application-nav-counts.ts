export type ApplicationStatusCountRow = {
  productId: string | null;
  productName: string | null;
  status: string;
  count: number;
};

export type ProductBaseRow = {
  id: string;
  base_id: string | null;
};

export type ApplicationNavCountItem = {
  baseProductId: string;
  financingTypeLabel: string;
  total: number;
  actionRequired: number;
};

export function aggregateApplicationNavCounts(
  rows: ApplicationStatusCountRow[],
  products: ProductBaseRow[],
  actionRequiredStatuses: readonly string[]
): ApplicationNavCountItem[] {
  const actionRequired = new Set(actionRequiredStatuses);
  const productIdToBase = new Map(
    products.map((row) => [row.id, (row.base_id ?? row.id) as string])
  );

  const byBase = new Map<
    string,
    { financingTypeLabel: string; total: number; actionRequired: number }
  >();

  for (const row of rows) {
    const productId = row.productId?.trim() || null;
    if (!productId) continue;
    const baseProductId = productIdToBase.get(productId) ?? productId;
    const existing = byBase.get(baseProductId);
    const label =
      existing?.financingTypeLabel || row.productName?.trim() || "Financing Product";
    const nextTotal = (existing?.total ?? 0) + row.count;
    const nextAction =
      (existing?.actionRequired ?? 0) + (actionRequired.has(row.status) ? row.count : 0);
    byBase.set(baseProductId, {
      financingTypeLabel: label,
      total: nextTotal,
      actionRequired: nextAction,
    });
  }

  return [...byBase.entries()].map(([baseProductId, value]) => ({
    baseProductId,
    financingTypeLabel: value.financingTypeLabel,
    total: value.total,
    actionRequired: value.actionRequired,
  }));
}
