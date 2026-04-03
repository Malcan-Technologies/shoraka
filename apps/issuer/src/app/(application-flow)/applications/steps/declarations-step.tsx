"use client";

import * as React from "react";
import { DeclarationHtmlContent } from "@cashsouk/ui/declaration-rich-text";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useApplication } from "@/hooks/use-applications";
import { DeclarationsSkeleton } from "@/app/(application-flow)/applications/components/declarations-skeleton";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";

/**
 * DECLARATIONS STEP
 * 
 * Shows legal declarations from product workflow.
 * User must check all boxes before they can save.
 * 
 * Data Flow:
 * 1. Load declarations text from stepConfig
 * 2. Check DB for saved checkbox states
 * 3. Show checkboxes with text
 * 4. When user toggles, pass data to parent
 * 5. Parent saves to DB when clicking "Save and Continue"
 * 
 * Database format: { declarations: [{checked: true}, {checked: false}] }
 */
interface DeclarationsStepProps {
  applicationId: string;
  stepConfig?: any;
  onDataChange?: (data: any) => void;
  readOnly?: boolean;
}

export function DeclarationsStep({
  applicationId,
  stepConfig,
  onDataChange,
  readOnly = false,
}: DeclarationsStepProps) {
  const devTools = useDevTools();
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);

  /**
 * Declarations source of truth:
 *
 * - Declaration TEXT comes from product workflow config (HTML: bold, lists):
 *   config.declarations = Array<{ text: string }>
 *
 * - Declaration CHECKED state is stored in DB:
 *   application.declarations = { declarations: [{ checked: boolean }] }
 *
 * We intentionally do NOT store text in the database.
 * This allows product updates without rewriting existing applications.
 */
  const declarations = React.useMemo(() => {
    const decls = stepConfig?.declarations;
    if (!Array.isArray(decls)) return [];

    return decls
      .map((d) => (typeof d === "object" && d?.text ? String(d.text) : ""))
      .filter(Boolean);
  }, [stepConfig?.declarations]);


  /**
   * Track which checkboxes are checked
   * 
   * Format: { 0: true, 1: false, 2: true }
   * The number is the index in the declarations array.
   */
  const [checkedDeclarations, setCheckedDeclarations] = React.useState<Record<number, boolean>>({});

  /**
   * Track initial state loaded from DB
   * 
   * We compare current state with this to know if user made changes
   */
  const [initialDeclarations, setInitialDeclarations] = React.useState<Record<number, boolean>>({});

  /**
   * Stable reference for onDataChange callback
   * 
   * We use a ref so the effect below doesn't re-run
   * every time the parent passes a new callback function.
   */
  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  /**
   * Track if we loaded data from DB yet
   * 
   * We only want to load once when the component first mounts.
   * This prevents overwriting user's changes if the application data refreshes.
   */
  const [isInitialized, setIsInitialized] = React.useState(false);

  /**
   * LOAD SAVED DATA FROM DATABASE
   * 
   * When the page loads, check if user already checked some boxes.
   * If yes, restore those checkbox states.
   * If no, start with all unchecked.
   */
  React.useEffect(() => {
    // Wait until we have data
    if (!application || declarations.length === 0) {
      return;
    }

    // Only initialize once
    if (isInitialized) {
      return;
    }

    const savedDeclarations = application.declarations as any;
    const initialState: Record<number, boolean> = {};

    if (savedDeclarations?.declarations && Array.isArray(savedDeclarations.declarations)) {
      // Load from DB
      savedDeclarations.declarations.forEach((item: any, index: number) => {
        if (index < declarations.length) {
          initialState[index] = item.checked || false;
        }
      });
    } else {
      // No saved data - start with all unchecked
      declarations.forEach((_: any, index: number) => {
        initialState[index] = false;
      });
    }

    setCheckedDeclarations(initialState);
    setInitialDeclarations(initialState); // Save initial state for comparison
    setIsInitialized(true);
  }, [application, declarations, isInitialized]);

  /**
   * NOTIFY PARENT WHEN DATA CHANGES
   * 
   * Every time the user checks/unchecks a box, we tell the parent.
   * The parent stores this in a ref and saves it when user clicks "Save and Continue".
   * 
   * We also include hasPendingChanges flag to tell parent if user made actual changes
   * vs just loading existing data from DB.
   */
  React.useEffect(() => {
    if (!onDataChangeRef.current || declarations.length === 0 || !isInitialized) {
      return;
    }

    // Build the data to save
    const dataToSave = declarations.map((_: any, index: number) => ({
      checked: checkedDeclarations[index] || false,
    }));

    // Check if all declarations are checked
    // This is required before user can save and continue
    const areAllDeclarationsChecked = declarations.every((_: any, index: number) => {
      return checkedDeclarations[index] === true;
    });

    // Check if user made changes from initial state
    const hasPendingChanges = Object.keys(checkedDeclarations).some((key) => {
      const index = parseInt(key);
      return checkedDeclarations[index] !== initialDeclarations[index];
    });

    const saveData = {
      declarations: dataToSave,
      hasPendingChanges: hasPendingChanges,
      areAllDeclarationsChecked: areAllDeclarationsChecked,
    };

    // Pass to parent (parent will validate)
    onDataChangeRef.current(saveData);
  }, [checkedDeclarations, declarations, isInitialized, initialDeclarations]);

  /**
   * HANDLE CHECKBOX TOGGLE
   * 
   * When user clicks a checkbox, update the state.
   */
  const handleToggle = React.useCallback((index: number, checked: boolean) => {
    setCheckedDeclarations((prev) => ({
      ...prev,
      [index]: checked,
    }));
  }, []);

  /**
   * LOADING STATE
   */
  if (isLoadingApp || !stepConfig || devTools?.showSkeletonDebug) {
    return <DeclarationsSkeleton />;
  }

  /**
   * EMPTY STATE
   */
  if (declarations.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-center py-8">
          No declarations required for this application.
        </p>
      </div>
    );
  }

  /**
   * MAIN UI
   * 
   * Left side: Checkboxes with declaration text
   * Right side: Info panel about what happens next
   * 
   * Layout: Grid that moves together - declarations and info panel are peers.
   * When there are more declarations, both grow together proportionally.
   */
return (
  <>
  <div className="px-3">
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
      {/* ================= DECLARATIONS BOX ================= */}
      <div className="rounded-xl border border-border bg-background p-4 sm:p-5 h-fit">
        <div className="space-y-3">
          {declarations.map((declaration: string, index: number) => {
            const isChecked = checkedDeclarations[index] || false;

            return (
              <label
                key={index}
                className="flex items-start gap-3 cursor-pointer"
              >
                {/* Checkbox */}
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    handleToggle(index, checked === true)
                  }
                  disabled={readOnly}
                  className={cn(
                    "mt-0.5 rounded-[4px]",
                    readOnly && "disabled:opacity-100 data-[state=checked]:bg-muted data-[state=checked]:border-muted-foreground data-[state=checked]:text-muted-foreground"
                  )}
                />

                {/* Declaration text (allowlisted HTML from product config) */}
                <DeclarationHtmlContent
                  className="min-w-0 flex-1"
                  html={declaration}
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* ================= WHAT HAPPENS NEXT ================= */}
      <div className="rounded-xl border border-border bg-background p-6">
        <h3 className="text-base font-semibold text-foreground mb-3">
          What happens next?
        </h3>
        <div className="border-b border-border mt-2 mb-4" />

        <ul className="list-disc pl-5 space-y-3 text-sm md:text-base leading-6 text-foreground mt-4">
          <li>After submission, your application will be reviewed by our team.</li>
          <li>If additional information is required, we will contact you for confirmation.</li>
          <li>
            Once approved, your financing request will be listed on the platform for investors.
          </li>
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
