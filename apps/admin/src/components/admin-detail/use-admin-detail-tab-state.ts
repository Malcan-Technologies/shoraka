"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

function readTabParam(paramName: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(paramName);
}

export type UseAdminDetailTabStateOptions<TTabId extends string> = {
  paramName?: string;
  isValidTab: (value: string) => value is TTabId;
  /** Auto-selected tab once the record has loaded; `null` while loading. */
  computedTab: TTabId | null;
};

/**
 * Tab selection for admin detail pages, synced to `?tab=`.
 *
 * The URL is read from `window.location.search` (not via `useSearchParams`,
 * which would force a Suspense boundary). A tab the user picks is never
 * overridden by a later re-render of the same record. Switching to another
 * note/contract resets selection so the new record can auto-open its own tab.
 */
export function useAdminDetailTabState<TTabId extends string>({
  paramName = "tab",
  isValidTab,
  computedTab,
}: UseAdminDetailTabStateOptions<TTabId>): {
  activeTab: TTabId | null;
  setActiveTab: (tab: TTabId) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = React.useState<TTabId | null>(() => {
    const fromUrl = readTabParam(paramName);
    return fromUrl && isValidTab(fromUrl) ? fromUrl : null;
  });
  const [tabPath, setTabPath] = React.useState(pathname);

  if (tabPath !== pathname) {
    setTabPath(pathname);
    const fromUrl = readTabParam(paramName);
    setActiveTab(fromUrl && isValidTab(fromUrl) ? fromUrl : null);
  }

  React.useEffect(() => {
    if (activeTab != null || computedTab == null) return;
    setActiveTab(computedTab);
  }, [activeTab, computedTab]);

  React.useEffect(() => {
    if (activeTab == null || typeof window === "undefined") return;
    if (pathname !== window.location.pathname) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(paramName) === activeTab) return;
    params.set(paramName, activeTab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [activeTab, paramName, pathname, router]);

  return { activeTab, setActiveTab };
}
