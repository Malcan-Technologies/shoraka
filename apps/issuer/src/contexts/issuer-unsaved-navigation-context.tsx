"use client";

import * as React from "react";

export type IssuerUnsavedNavGuard = {
  hasUnsavedChanges: boolean;
  /**
   * Internal navigation only (same origin). Return false when the modal will handle next steps.
   * Return true to allow default (e.g. external URL — not intercepted).
   */
  tryNavigate: (pathnameSearchHash: string) => boolean | Promise<boolean>;
};

type Ctx = {
  guard: IssuerUnsavedNavGuard | null;
  setGuard: React.Dispatch<React.SetStateAction<IssuerUnsavedNavGuard | null>>;
};

const IssuerUnsavedNavigationContext = React.createContext<Ctx | null>(null);

export function IssuerUnsavedNavigationProvider({ children }: { children: React.ReactNode }) {
  const [guard, setGuard] = React.useState<IssuerUnsavedNavGuard | null>(null);
  const value = React.useMemo(() => ({ guard, setGuard }), [guard]);

  return (
    <IssuerUnsavedNavigationContext.Provider value={value}>
      {children}
      <IssuerUnsavedLinkInterceptor />
    </IssuerUnsavedNavigationContext.Provider>
  );
}

export function useIssuerUnsavedNavigation() {
  const ctx = React.useContext(IssuerUnsavedNavigationContext);
  if (!ctx) {
    throw new Error("useIssuerUnsavedNavigation must be used within IssuerUnsavedNavigationProvider");
  }
  return ctx;
}

function IssuerUnsavedLinkInterceptor() {
  const { guard } = useIssuerUnsavedNavigation();

  React.useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (!guard?.hasUnsavedChanges) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const el = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!el) return;
      const a = el as HTMLAnchorElement;
      if (a.target === "_blank" || a.download) return;
      const hrefAttr = a.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#")) return;
      if (hrefAttr.startsWith("mailto:") || hrefAttr.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(hrefAttr, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const next = url.pathname + url.search + url.hash;
      const current = window.location.pathname + window.location.search + window.location.hash;
      if (next === current) return;

      e.preventDefault();
      e.stopPropagation();
      void guard.tryNavigate(next);
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [guard]);

  return null;
}
