"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useApplication } from "@/hooks/use-applications";

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
}

export function DeclarationsStep({
  applicationId,
  stepConfig,
  onDataChange,
}: DeclarationsStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);

  /**
 * Declarations source of truth:
 *
 * - Declaration TEXT comes from product workflow config:
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
  if (isLoadingApp || !stepConfig) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 sm:gap-6">
        <div>
          <div className="border rounded-xl p-4 sm:p-6 bg-card">
            <div>
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 sm:gap-3 py-3"
                >
                  <div className="shrink-0 mt-1">
                    <Skeleton className="h-[18px] w-[18px] rounded" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="border rounded-xl p-4 sm:p-6 bg-card">
            <Skeleton className="h-6 w-40 mb-3" />
            <div className="pl-[18px] space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
            <Skeleton className="h-4 w-full mt-4" />
          </div>
        </div>
      </div>
    );
  }

  /**
   * EMPTY STATE
   */
  if (declarations.length === 0) {
    return (
      <div className="space-y-4">
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
   */
return (
  <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 px-3">
  {/* ================= LEFT: DECLARATIONS ================= */}
  <div className="rounded-xl border border-border bg-background p-6">
    <div className="space-y-5">
      {declarations.map((declaration: string, index: number) => {
        const isChecked = checkedDeclarations[index] || false;

        return (
          <label
            key={index}
            className="
              flex items-start gap-4
              cursor-pointer
            "
          >
            {/* Checkbox */}
            <div className="shrink-0">
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) =>
                  handleToggle(index, checked === true)
                }
                className="
                  rounded-sm
                  border-destructive
                  data-[state=checked]:bg-destructive
                  data-[state=checked]:border-destructive
                "
              />
            </div>

            {/* Text */}
            <span className="text-[16px] leading-[24px] text-foreground">
              {declaration}
            </span>
          </label>
        );
      })}
    </div>
  </div>

  {/* ================= RIGHT: WHAT HAPPENS NEXT ================= */}
  <div className="rounded-xl border border-border bg-background p-6">
    <h3 className="text-lg font-semibold text-foreground mb-4">
      What happens next?
    </h3>
    <div className="mt-2 h-px bg-border" />

    <ul className="list-disc pl-5 space-y-3 text-[16px] leading-[24px] text-foreground">
      <li>After submission, your application will be reviewed by our team.</li>
      <li>If additional information is required, we will contact you for confirmation.</li>
      <li>
        Once approved, your financing request will be listed on the platform
        for investors.
      </li>
    </ul>

    <p className="mt-5 text-[15px] leading-[22px] text-muted-foreground">
      Submitting this application confirms that all declarations provided are
      accurate and complete.
    </p>
  </div>
</div>

)
}
