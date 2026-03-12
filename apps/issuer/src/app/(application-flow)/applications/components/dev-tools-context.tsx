// DEV TOOL CONTEXT
// Safe to delete entirely without affecting application logic.

"use client";

import * as React from "react";

interface DevToolsContextValue {
  showSkeletonDebug: boolean;
  setShowSkeletonDebug: (v: boolean) => void;
  autoFillData: { stepKey: string; data: Record<string, unknown> } | null;
  requestAutoFill: (stepKey: string, data: Record<string, unknown>) => void;
  clearAutoFill: () => void;
}

const DevToolsContext = React.createContext<DevToolsContextValue | null>(null);

export function DevToolsProvider({ children }: { children: React.ReactNode }) {
  const [showSkeletonDebug, setShowSkeletonDebug] = React.useState(false);
  const [autoFillData, setAutoFillData] = React.useState<{
    stepKey: string;
    data: Record<string, unknown>;
  } | null>(null);

  const requestAutoFill = React.useCallback((stepKey: string, data: Record<string, unknown>) => {
    setAutoFillData({ stepKey, data });
  }, []);

  const clearAutoFill = React.useCallback(() => {
    setAutoFillData(null);
  }, []);

  const value = React.useMemo(
    () => ({
      showSkeletonDebug,
      setShowSkeletonDebug,
      autoFillData,
      requestAutoFill,
      clearAutoFill,
    }),
    [showSkeletonDebug, autoFillData, requestAutoFill, clearAutoFill]
  );

  return <DevToolsContext.Provider value={value}>{children}</DevToolsContext.Provider>;
}

export function useDevTools() {
  return React.useContext(DevToolsContext);
}
