"use client";

import * as React from "react";
import { DeclarationHtmlContent } from "@cashsouk/ui/declaration-rich-text";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { DeclarationsSkeleton } from "@/app/(application-flow)/applications/components/declarations-skeleton";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";
import {
  applicationFlowSectionDividerClassName,
  applicationFlowSectionTitleClassName,
  applicationFlowStepOuterClassName,
} from "@/app/(application-flow)/applications/components/form-control";

type SavedDeclarationsShape = {
  declarations?: { checked?: boolean }[];
} | null;

export interface DeclarationsStepProps {
  applicationId: string;
  stepConfig?: Record<string, unknown>;
  onDataChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
  resetCheckboxesForAmendment?: boolean;
  /** Parent `application.declarations` — avoids a second `useApplication` subscription and refetch-driven UI flashes on submit. */
  savedDeclarationsField?: unknown;
  /** False until the parent has an application row (first load). */
  hasApplicationPayload?: boolean;
  /** True only for the initial application fetch (no row yet). */
  isDeclarationsHydrationLoading?: boolean;
  /** While final submit runs, never swap this step for a skeleton (parent may refetch). */
  suppressLoadingSkeleton?: boolean;
}

function buildInitialCheckedState(
  declarationsLength: number,
  resetCheckboxesForAmendment: boolean,
  saved: SavedDeclarationsShape
): Record<number, boolean> {
  const initialState: Record<number, boolean> = {};
  if (resetCheckboxesForAmendment) {
    for (let i = 0; i < declarationsLength; i++) initialState[i] = false;
    return initialState;
  }
  const rows = saved?.declarations;
  if (Array.isArray(rows)) {
    rows.forEach((item, index) => {
      if (index < declarationsLength) initialState[index] = Boolean(item?.checked);
    });
  }
  for (let i = 0; i < declarationsLength; i++) {
    if (initialState[i] === undefined) initialState[i] = false;
  }
  return initialState;
}

export function DeclarationsStep({
  stepConfig,
  onDataChange,
  readOnly = false,
  resetCheckboxesForAmendment = false,
  savedDeclarationsField,
  hasApplicationPayload = false,
  isDeclarationsHydrationLoading = false,
  suppressLoadingSkeleton = false,
}: DeclarationsStepProps) {
  const devTools = useDevTools();

  const declarations = React.useMemo(() => {
    const decls = stepConfig?.declarations;
    if (!Array.isArray(decls)) return [];
    return decls
      .map((d) => (typeof d === "object" && d && "text" in d ? String((d as { text?: string }).text) : ""))
      .filter(Boolean);
  }, [stepConfig?.declarations]);

  const [checkedDeclarations, setCheckedDeclarations] = React.useState<Record<number, boolean>>({});
  const [initialDeclarations, setInitialDeclarations] = React.useState<Record<number, boolean>>({});
  const [isInitialized, setIsInitialized] = React.useState(false);

  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  React.useEffect(() => {
    if (declarations.length === 0 || isInitialized) return;

    if (!resetCheckboxesForAmendment) {
      if (!hasApplicationPayload || isDeclarationsHydrationLoading) return;
    }

    const saved = savedDeclarationsField as SavedDeclarationsShape;
    const initialState = buildInitialCheckedState(
      declarations.length,
      resetCheckboxesForAmendment,
      saved
    );
    setCheckedDeclarations(initialState);
    setInitialDeclarations(initialState);
    setIsInitialized(true);
  }, [
    declarations.length,
    hasApplicationPayload,
    isDeclarationsHydrationLoading,
    isInitialized,
    resetCheckboxesForAmendment,
    savedDeclarationsField,
    declarations,
  ]);

  React.useEffect(() => {
    if (!onDataChangeRef.current || declarations.length === 0 || !isInitialized) return;

    const dataToSave = declarations.map((_, index) => ({
      checked: checkedDeclarations[index] === true,
    }));

    const areAllDeclarationsChecked = declarations.every((_, index) => checkedDeclarations[index] === true);

    const hasPendingChanges = Object.keys(checkedDeclarations).some((key) => {
      const index = parseInt(key, 10);
      return checkedDeclarations[index] !== initialDeclarations[index];
    });

    onDataChangeRef.current({
      declarations: dataToSave,
      hasPendingChanges,
      areAllDeclarationsChecked,
    });
  }, [checkedDeclarations, declarations, isInitialized, initialDeclarations]);

  const handleToggle = React.useCallback((index: number, checked: boolean) => {
    setCheckedDeclarations((prev) => ({ ...prev, [index]: checked }));
  }, []);

  const showSkeleton =
    !suppressLoadingSkeleton &&
    (!stepConfig ||
      devTools?.showSkeletonDebug ||
      (isDeclarationsHydrationLoading && !hasApplicationPayload));

  if (showSkeleton) {
    return <DeclarationsSkeleton />;
  }

  if (declarations.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-center py-8">No declarations required for this application.</p>
      </div>
    );
  }

  return (
    <>
      <div className={applicationFlowStepOuterClassName}>
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <div className="rounded-xl border border-border bg-background p-4 sm:p-5 h-fit">
            <div className="space-y-3">
              {declarations.map((declaration: string, index: number) => {
                const isChecked = checkedDeclarations[index] === true;
                return (
                  <label key={index} className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => handleToggle(index, checked === true)}
                      disabled={readOnly}
                      className={cn(
                        "mt-0.5 rounded-[4px]",
                        readOnly &&
                          "disabled:opacity-100 data-[state=checked]:bg-muted data-[state=checked]:border-muted-foreground data-[state=checked]:text-muted-foreground"
                      )}
                    />
                    <DeclarationHtmlContent className="min-w-0 flex-1" html={declaration} />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-6">
            <div>
              <h3 className={applicationFlowSectionTitleClassName}>What happens next?</h3>
              <div className={applicationFlowSectionDividerClassName} />
            </div>

            <ul className="list-disc pl-5 space-y-3 text-sm md:text-base leading-6 text-foreground mt-4">
              <li>After submission, your application will be reviewed by our team.</li>
              <li>If additional information is required, we will contact you for confirmation.</li>
              <li>Once approved, your financing request will be listed on the platform for investors.</li>
            </ul>

            <p className="mt-5 text-xs md:text-sm leading-6 text-muted-foreground">
              Submitting this application confirms that all declarations provided are accurate and complete.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
