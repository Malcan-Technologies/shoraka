import type { ApplicationNavCountItem, Product } from "@cashsouk/types";
import { productName } from "@/app/settings/products/product-utils";

export type ApplicationNavGroup = {
  baseKey: string;
  productTitle: string;
  queuePath: string;
  isInactive: boolean;
  pendingActionCount: number;
};

/** Avoid empty or punctuation-only titles (e.g. "—") in the sidebar. */
export function applicationsSidebarProductLabel(title: string): string {
  const t = title.trim();
  if (!t) return "Unnamed product";
  if (/^[\u002d\u2013\u2014\u2015\u2212_.\u00b7\s]+$/u.test(t)) return "Unnamed product";
  return t;
}

function sumCountsForKeys(
  navCounts: ApplicationNavCountItem[],
  keys: Iterable<string>
): { total: number; actionRequired: number } {
  const keySet = new Set(keys);
  let total = 0;
  let actionRequired = 0;
  for (const item of navCounts) {
    if (!keySet.has(item.baseProductId)) continue;
    total += item.total;
    actionRequired += item.actionRequired;
  }
  return { total, actionRequired };
}

export function buildApplicationSidebarGroups(
  products: Product[],
  navCounts: ApplicationNavCountItem[]
): ApplicationNavGroup[] {
  const byBase = new Map<string, Product[]>();
  for (const p of products) {
    const key = (p.base_id ?? p.id) as string;
    const list = byBase.get(key) ?? [];
    list.push(p);
    byBase.set(key, list);
  }

  const groups: ApplicationNavGroup[] = [];
  const consumedCountKeys = new Set<string>();

  for (const [, versions] of byBase) {
    const sorted = [...versions].sort((a, b) => a.version - b.version);
    const display =
      [...sorted].reverse().find((p) => (p.status ?? "ACTIVE") === "ACTIVE") ??
      sorted[sorted.length - 1];
    if (!display) continue;
    const baseKey = (display.base_id ?? display.id) as string;
    const countKeys = [baseKey, ...versions.map((p) => p.id)];
    const counts = sumCountsForKeys(navCounts, countKeys);
    const isLive = (display.status ?? "ACTIVE") === "ACTIVE";
    if (!isLive && counts.total === 0) continue;

    for (const key of countKeys) consumedCountKeys.add(key);

    groups.push({
      baseKey,
      productTitle: productName(display),
      queuePath: `/applications/${baseKey}`,
      isInactive: !isLive,
      pendingActionCount: counts.actionRequired,
    });
  }

  const basesBuilt = new Set(groups.map((g) => g.baseKey));
  for (const counts of navCounts) {
    if (basesBuilt.has(counts.baseProductId) || consumedCountKeys.has(counts.baseProductId)) {
      continue;
    }
    if (counts.total === 0) continue;
    groups.push({
      baseKey: counts.baseProductId,
      productTitle: counts.financingTypeLabel || "Product",
      queuePath: `/applications/${counts.baseProductId}`,
      isInactive: true,
      pendingActionCount: counts.actionRequired,
    });
  }

  return groups.sort((a, b) => {
    if (a.isInactive !== b.isInactive) {
      return a.isInactive ? 1 : -1;
    }
    return a.productTitle.localeCompare(b.productTitle, undefined, { sensitivity: "base" });
  });
}

/** Pending action-required applications for products that are currently active (not rolled up into inactive products). */
export function activeProductPendingActionTotal(groups: ApplicationNavGroup[]): number {
  return groups.filter((g) => !g.isInactive).reduce((sum, g) => sum + g.pendingActionCount, 0);
}

export function activeProductBaseKeySet(groups: ApplicationNavGroup[]): Set<string> {
  return new Set(groups.filter((g) => !g.isInactive).map((g) => g.baseKey));
}

export function firstActiveActionQueuePath(groups: ApplicationNavGroup[]): string | null {
  const withActions = groups.find((g) => !g.isInactive && g.pendingActionCount > 0);
  if (withActions) return withActions.queuePath;
  const firstActive = groups.find((g) => !g.isInactive);
  return firstActive?.queuePath ?? null;
}
