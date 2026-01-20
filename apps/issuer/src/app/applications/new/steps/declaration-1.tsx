"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@cashsouk/ui";
import type { StepComponentProps } from "../step-components";
import { useApplication } from "@/hooks/use-applications";

export default function DeclarationStep({
  stepConfig,
  applicationId,
  onDataChange,
}: StepComponentProps) {
  const { data: application } = useApplication(applicationId);

  const existingData = React.useMemo(() => {
    if (!application?.declaration) {
      return null;
    }
    const decl = application.declaration;
    
    if (Array.isArray(decl) && decl.length > 0) {
      if (typeof decl[0] === 'boolean') {
        return (decl as boolean[]).map(checked => ({ checked }));
      }
      return decl as Array<{ checked: boolean; [key: string]: unknown }>;
    }
    
    if (typeof decl === 'object' && decl !== null && 'declarations' in decl) {
      const legacy = decl as {
        declarations?: Array<{
          id: string;
          checked: boolean;
        }>;
      };
      if (legacy.declarations) {
        return legacy.declarations
          .sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10))
          .map(d => ({ checked: d.checked }));
      }
    }
    
    return null;
  }, [application]);

  const declarations = React.useMemo(() => {
    if (!stepConfig || !stepConfig.declarations || !Array.isArray(stepConfig.declarations)) {
      return [];
    }
    return stepConfig.declarations as string[];
  }, [stepConfig]);

  const [checkedDeclarations, setCheckedDeclarations] = React.useState<Map<number, boolean>>(new Map());

  React.useEffect(() => {
    const state = new Map<number, boolean>();

    if (Array.isArray(existingData)) {
      existingData.forEach((item, index) => {
        const checked = typeof item === 'object' && item !== null && 'checked' in item
          ? (item as { checked: boolean }).checked
          : false;
        state.set(index, checked);
      });
    } else {
      declarations.forEach((_, index) => {
        state.set(index, false);
      });
    }

    setCheckedDeclarations(state);
  }, [existingData, declarations]);

  const handleDeclarationToggle = React.useCallback((index: number, checked: boolean) => {
    setCheckedDeclarations((prev) => {
      const newState = new Map(prev);
      newState.set(index, checked);
      return newState;
    });
  }, []);

  React.useEffect(() => {
    if (!applicationId || !onDataChange) return;

    const dataToSave = declarations.map((_, index) => ({
      checked: checkedDeclarations.get(index) || false,
    }));

    onDataChange({
      declaration: dataToSave,
    });
  }, [checkedDeclarations, applicationId, onDataChange, declarations]);

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

  const allChecked = Array.from(checkedDeclarations.values()).every(checked => checked);
  const isFirstDeclaration = declarations.length > 0;

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-xl p-6 space-y-4">
        <label className="flex items-start gap-3 font-medium text-foreground">
          <Checkbox
            checked={allChecked}
            onCheckedChange={(checked) => {
              declarations.forEach((_, index) => {
                handleDeclarationToggle(index, checked === true);
              });
            }}
            className="mt-1 w-4 h-4 rounded-none"
          />
          I / We hereby declare and confirm that
        </label>
        <ul className="list-decimal list-inside text-foreground space-y-2 pl-6">
          {declarations.map((declaration, index) => (
            <li key={index}>{declaration}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
