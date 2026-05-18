import type { ApplicationListItem, Product } from "@cashsouk/types";
import { APPLICATION_ACTION_REQUIRED_STATUS_SET } from "@/applications/action-required-statuses";
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

export function buildApplicationSidebarGroups(
  products: Product[],
  applications: ApplicationListItem[]
): ApplicationNavGroup[] {
  const byBase = new Map<string, Product[]>();
  for (const p of products) {
    const key = (p.base_id ?? p.id) as string;
    const list = byBase.get(key) ?? [];
    list.push(p);
    byBase.set(key, list);
  }

  const groups: ApplicationNavGroup[] = [];

  for (const [, versions] of byBase) {
    const sorted = [...versions].sort((a, b) => a.version - b.version);
    const display =
      [...sorted].reverse().find((p) => (p.status ?? "ACTIVE") === "ACTIVE") ?? sorted[sorted.length - 1];
    if (!display) continue;
    const baseKey = (display.base_id ?? display.id) as string;
    const appsFor = applications.filter((a) => (a.baseProductId ?? "") === baseKey);
    const pendingActionCount = appsFor.filter((a) =>
      APPLICATION_ACTION_REQUIRED_STATUS_SET.has(a.status)
    ).length;
    const isLive = (display.status ?? "ACTIVE") === "ACTIVE";
    if (!isLive && appsFor.length === 0) continue;

    groups.push({
      baseKey,
      productTitle: productName(display),
      queuePath: `/applications/${baseKey}`,
      isInactive: !isLive,
      pendingActionCount,
    });
  }

  const basesBuilt = new Set(groups.map((g) => g.baseKey));
  for (const baseKey of new Set(
    applications.map((a) => a.baseProductId).filter((x): x is string => Boolean(x))
  )) {
    if (basesBuilt.has(baseKey)) continue;
    const appsFor = applications.filter((a) => a.baseProductId === baseKey);
    if (appsFor.length === 0) continue;
    groups.push({
      baseKey,
      productTitle: appsFor[0]?.financingTypeLabel ?? "Product",
      queuePath: `/applications/${baseKey}`,
      isInactive: true,
      pendingActionCount: appsFor.filter((a) => APPLICATION_ACTION_REQUIRED_STATUS_SET.has(a.status)).length,
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
