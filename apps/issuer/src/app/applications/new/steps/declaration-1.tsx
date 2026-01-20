"use client";

import * as React from "react";
import { Checkbox } from "@cashsouk/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { StepComponentProps } from "../step-components";
import { useApplication } from "@/hooks/use-applications";

export default function DeclarationStep({
  stepConfig,
  applicationId,
  onDataChange,
}: StepComponentProps) {
  const { data: application } = useApplication(applicationId);

  // Get declarations from step config
  const declarations: string[] = React.useMemo(() => {
    if (!stepConfig?.declarations || !Array.isArray(stepConfig.declarations)) {
      return [];
    }
    return stepConfig.declarations as string[];
  }, [stepConfig]);

  // Load existing checked state from application data
  const existingData = React.useMemo(() => {
    if (!application?.declaration) {
      return null;
    }

    const decl = application.declaration;

    // Handle array format: [{ checked: boolean }, ...]
    if (Array.isArray(decl) && decl.length > 0) {
      if (typeof decl[0] === "boolean") {
        return (decl as boolean[]).map((checked) => ({ checked }));
      }
      return decl as Array<{ checked: boolean }>;
    }

    // Handle legacy format: { declarations: [{ id: string, checked: boolean }] }
    if (typeof decl === "object" && decl !== null && "declarations" in decl) {
      const legacy = decl as {
        declarations?: Array<{
          id: string;
          checked: boolean;
        }>;
      };
      if (legacy.declarations) {
        return legacy.declarations
          .sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10))
          .map((d) => ({ checked: d.checked }));
      }
    }

    return null;
  }, [application]);

  // State to track which declarations are checked
  const [checkedDeclarations, setCheckedDeclarations] = React.useState<Record<number, boolean>>({});

  // Initialize checked state from existing data
  React.useEffect(() => {
    const initialState: Record<number, boolean> = {};

    if (Array.isArray(existingData)) {
      existingData.forEach((item, index) => {
        const checked = typeof item === "object" && item !== null && "checked" in item
          ? (item as { checked: boolean }).checked
          : false;
        initialState[index] = checked;
      });
    } else {
      // Initialize all as unchecked
      declarations.forEach((_, index) => {
        initialState[index] = false;
      });
    }

    setCheckedDeclarations(initialState);
  }, [existingData, declarations]);

  // Handle when user checks/unchecks a declaration
  const handleToggle = React.useCallback((index: number, checked: boolean) => {
    setCheckedDeclarations((prev) => ({
      ...prev,
      [index]: checked,
    }));
  }, []);

  // Save data whenever checked state changes
  React.useEffect(() => {
    if (!applicationId || !onDataChange) {
      return;
    }

    const dataToSave = declarations.map((_, index) => ({
      checked: checkedDeclarations[index] || false,
    }));

    onDataChange({
      declaration: dataToSave,
    });
  }, [checkedDeclarations, applicationId, onDataChange, declarations]);


  // Show skeleton while loading (when stepConfig is not available yet)
  const isLoading = !stepConfig;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className={cn(
              "flex items-start gap-3 p-5 border rounded-xl max-w-2xl",
              "border-border"
            )}
          >
            <div className="pt-0.5 shrink-0">
              <Skeleton className="h-5 w-5 rounded-none" />
            </div>
            <div className="flex gap-2 flex-1 min-w-0">
              <Skeleton className="h-[21px] w-4 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-[21px] w-full max-w-md" />
                <Skeleton className="h-[21px] w-3/4 max-w-sm" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Show message if no declarations
  if (declarations.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-center py-8">
          No declarations required for this application.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {declarations.map((declaration, index) => {
        const isChecked = checkedDeclarations[index] || false;
        const declarationNumber = index + 1;

        return (
          <label
            key={index}
            className={cn(
              "flex items-start gap-3 p-5 border rounded-xl cursor-pointer max-w-2xl",
              "border-border hover:border-primary/50"
            )}
            style={{ transition: 'none' }}
          >
            <div className="pt-0.5 shrink-0">
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => handleToggle(index, checked === true)}
                className="rounded-none transition-none [&>span]:transition-none [&>span[data-state]]:transition-none"
              />
            </div>
            <div className="flex gap-2 flex-1 min-w-0">
              <span className="font-semibold text-foreground shrink-0 text-[17px] leading-7">{declarationNumber}.</span>
              <p className="text-[17px] leading-7 text-foreground break-words max-w-full">
                {declaration}
              </p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
