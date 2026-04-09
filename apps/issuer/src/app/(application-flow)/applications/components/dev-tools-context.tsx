// DEV TOOL CONTEXT
// Safe to delete entirely without affecting application logic.

"use client";

import * as React from "react";

interface DevToolsContextValue {
  showSkeletonDebug: boolean;
  setShowSkeletonDebug: (v: boolean) => void;
  /** Full-page wizard loading / blocked shell (generic skeleton). Dev-only preview. */
  previewWizardLoadingShell: boolean;
  setPreviewWizardLoadingShell: (v: boolean) => void;
  autoFillData: { stepKey: string; data: Record<string, unknown> } | null;
  autoFillDataMap: Record<string, Record<string, unknown>>;
  requestAutoFill: (stepKey: string, data: Record<string, unknown>) => void;
  requestAutoFillForAllSteps: (map: Record<string, Record<string, unknown>>) => void;
  clearAutoFill: () => void;
  clearAutoFillForStep: (stepKey: string) => void;
}

const DevToolsContext = React.createContext<DevToolsContextValue | null>(null);

export function DevToolsProvider({ children }: { children: React.ReactNode }) {
  const [showSkeletonDebug, setShowSkeletonDebug] = React.useState(false);
  const [previewWizardLoadingShell, setPreviewWizardLoadingShell] = React.useState(false);
  const [autoFillData, setAutoFillData] = React.useState<{
    stepKey: string;
    data: Record<string, unknown>;
  } | null>(null);
  const [autoFillDataMap, setAutoFillDataMap] = React.useState<
    Record<string, Record<string, unknown>>
  >({});

  const requestAutoFill = React.useCallback((stepKey: string, data: Record<string, unknown>) => {
    setAutoFillData({ stepKey, data });
  }, []);

  const requestAutoFillForAllSteps = React.useCallback(
    (map: Record<string, Record<string, unknown>>) => {
      setAutoFillData(null);
      setAutoFillDataMap(map);
    },
    []
  );

  const clearAutoFill = React.useCallback(() => {
    setAutoFillData(null);
    setAutoFillDataMap({});
  }, []);

  const clearAutoFillForStep = React.useCallback((stepKey: string) => {
    setAutoFillDataMap((prev) => {
      const next = { ...prev };
      delete next[stepKey];
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({
      showSkeletonDebug,
      setShowSkeletonDebug,
      previewWizardLoadingShell,
      setPreviewWizardLoadingShell,
      autoFillData,
      autoFillDataMap,
      requestAutoFill,
      requestAutoFillForAllSteps,
      clearAutoFill,
      clearAutoFillForStep,
    }),
    [
      showSkeletonDebug,
      previewWizardLoadingShell,
      autoFillData,
      autoFillDataMap,
      requestAutoFill,
      requestAutoFillForAllSteps,
      clearAutoFill,
      clearAutoFillForStep,
    ]
  );

  return <DevToolsContext.Provider value={value}>{children}</DevToolsContext.Provider>;
}

export function useDevTools() {
  return React.useContext(DevToolsContext);
}
