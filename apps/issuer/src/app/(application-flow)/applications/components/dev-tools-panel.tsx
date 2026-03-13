// DEV TOOLS PANEL
// Central location for development utilities.
// Safe to delete if dev tools are no longer needed.

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDevTools } from "./dev-tools-context";
import { toast } from "sonner";
import { generateAllDataForSteps } from "../utils/dev-data-generator";

/** Registry of step keys to mock data generators. Add new steps here. */
const MOCK_GENERATORS: Record<string, () => Record<string, unknown>> = {};

/** Register a mock generator for a step. Called by step modules. */
export function registerMockGenerator(stepKey: string, fn: () => Record<string, unknown>) {
  MOCK_GENERATORS[stepKey] = fn;
}

interface DevToolsPanelProps {
  currentStepKey: string | null;
  onPreviewAmendment: () => void;
  isPreviewAmendmentActive: boolean;
  approvedContractIds?: string[];
}

export function DevToolsPanel({
  currentStepKey,
  onPreviewAmendment,
  isPreviewAmendmentActive,
  approvedContractIds = [],
}: DevToolsPanelProps) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const devTools = useDevTools();

  const handleToggleSkeleton = React.useCallback(() => {
    const next = !(devTools?.showSkeletonDebug ?? false);
    devTools?.setShowSkeletonDebug(next);
    toast.success(next ? "Skeleton debug on" : "Skeleton debug off");
  }, [devTools]);

  const handleAutoFill = React.useCallback(() => {
    if (!currentStepKey || !devTools) return;
    const generator = MOCK_GENERATORS[currentStepKey];
    if (!generator) {
      toast.error(`No mock generator for step: ${currentStepKey}`);
      return;
    }
    try {
      const data = generator();
      devTools.requestAutoFill(currentStepKey, data);
      toast.success(`Auto-filled ${currentStepKey}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auto-fill failed");
    }
  }, [currentStepKey, devTools]);

  const handlePreviewAmendment = React.useCallback(() => {
    onPreviewAmendment();
    toast.success(isPreviewAmendmentActive ? "Amendment preview off" : "Amendment preview on");
  }, [onPreviewAmendment, isPreviewAmendmentActive]);

  const handleFillEntireApplication = React.useCallback(() => {
    if (!devTools) return;
    try {
      const map = generateAllDataForSteps({ approvedContractIds });
      devTools.requestAutoFillForAllSteps(map);
      toast.success("Dummy data filled. You can now navigate through steps quickly.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fill entire application failed");
    }
  }, [devTools, approvedContractIds]);

  const devActions = [
    { label: "Fill Entire Application", action: handleFillEntireApplication },
    { label: "Auto Fill Step", action: handleAutoFill },
    { label: "Toggle Skeleton", action: handleToggleSkeleton },
    { label: "Preview Amendment", action: handlePreviewAmendment },
  ];

  return (
    <Card
      className="fixed bottom-5 right-5 z-[9999] w-[200px] shadow-lg border-2"
      data-testid="dev-tools-panel"
    >
      <CardHeader className="py-2 px-3">
        <h3 className="text-sm font-semibold">Dev Tools</h3>
      </CardHeader>
      <Separator />
      <CardContent className="py-2 px-3 space-y-1">
        {devActions.map(({ label, action }) => (
          <Button
            key={label}
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs h-8"
            onClick={action}
          >
            {label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
