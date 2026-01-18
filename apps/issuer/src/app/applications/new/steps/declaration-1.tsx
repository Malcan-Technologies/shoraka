"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@cashsouk/ui";
import { Label } from "@/components/ui/label";
import type { StepComponentProps } from "../step-components";
import { useApplication } from "@/hooks/use-applications";

/**
 * Declaration Step Component
 * 
 * This component displays individual checkboxes for each declaration.
 * Users must manually check each declaration to confirm they agree.
 * 
 * Step ID: "declaration-1" or "declaration_1"
 * File name: declaration-1.tsx
 */
export default function DeclarationStep({
  stepConfig,
  applicationId,
  onDataChange,
}: StepComponentProps) {
  // Fetch existing application data
  const { data: application } = useApplication(applicationId);

  // Load existing declaration data
  // Structure: { declarations: [{ id: string, checked: boolean }] }
  const existingData = React.useMemo(() => {
    if (!application?.declaration) {
      return null;
    }
    return application.declaration as {
      declarations?: Array<{
        id: string;
        checked: boolean;
      }>;
    } | null;
  }, [application]);

  // Get declarations from step config
  // stepConfig.declarations is an array of strings like:
  // ["Declaration statement 1", "Declaration statement 2", ...]
  const declarations = React.useMemo(() => {
    if (!stepConfig || !stepConfig.declarations || !Array.isArray(stepConfig.declarations)) {
      return [];
    }
    return stepConfig.declarations as string[];
  }, [stepConfig]);

  // Track checked state for each declaration
  // Map structure: declaration index → checked (true/false)
  const [checkedDeclarations, setCheckedDeclarations] = React.useState<
    Map<number, boolean>
  >(new Map());

  // Initialize state from existing data
  React.useEffect(() => {
    const state = new Map<number, boolean>();

    if (existingData?.declarations) {
      // Load from existing data
      existingData.declarations.forEach((decl) => {
        // Find the index of this declaration by matching the id
        const index = parseInt(decl.id, 10);
        if (!isNaN(index)) {
          state.set(index, decl.checked);
        }
      });
    } else {
      // Initialize all to false if no existing data
      declarations.forEach((_, index) => {
        state.set(index, false);
      });
    }

    setCheckedDeclarations(state);
  }, [existingData, declarations]);

  // Handle individual declaration checkbox toggle
  const handleDeclarationToggle = React.useCallback((index: number, checked: boolean) => {
    setCheckedDeclarations((prev) => {
      const newState = new Map(prev);
      newState.set(index, checked);
      return newState;
    });
  }, []);

  // Save data to application when declarations change
  React.useEffect(() => {
    if (!applicationId || !onDataChange) return;

    // Build data structure with all declarations and their checked status
    const dataToSave = {
      declarations: declarations.map((_, index) => ({
        id: index.toString(),
        checked: checkedDeclarations.get(index) || false,
      })),
    };

    // Send to parent component
    onDataChange({
      declaration: dataToSave,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedDeclarations, applicationId]);

  // Show message if no declarations configured
  if (declarations.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              No declarations required for this application.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Individual declaration checkboxes - each in its own card */}
      {declarations.map((declaration, index) => {
        const isChecked = checkedDeclarations.get(index) || false;
        const declarationId = `declaration-${index}`;

        return (
          <Card
            key={index}
            className="cursor-pointer hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => handleDeclarationToggle(index, !isChecked)}
            tabIndex={0}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={declarationId}
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    handleDeclarationToggle(index, checked === true)
                  }
                  className="rounded-none pointer-events-none transition-none [&>span]:transition-none [&>span[data-state]]:transition-none"
                />
                <div className="flex-1 space-y-0">
                  <Label
                    htmlFor={declarationId}
                    className="text-sm font-medium leading-relaxed cursor-pointer pointer-events-none"
                  >
                    {declaration}
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
