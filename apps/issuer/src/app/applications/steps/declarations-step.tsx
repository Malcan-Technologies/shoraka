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
   * Get declarations array from config
   * 
   * The product workflow has: config.declarations = ["text 1", "text 2", ...]
   * We use useMemo to avoid re-creating the array on every render.
   */
  const declarations = React.useMemo(() => {
    const decls = stepConfig?.declarations;
    return Array.isArray(decls) ? decls : [];
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

    // Check if user made changes from initial state
    const hasPendingChanges = Object.keys(checkedDeclarations).some((key) => {
      const index = parseInt(key);
      return checkedDeclarations[index] !== initialDeclarations[index];
    });

    const saveData = {
      declarations: dataToSave,
      hasPendingChanges: hasPendingChanges,
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
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 sm:gap-6">
      <div>
        <div className="border rounded-xl p-4 sm:p-6 bg-card space-y-4 sm:space-y-6">
          {declarations.map((declaration: string, index: number) => {
            const isChecked = checkedDeclarations[index] || false;

            return (
              <label
                key={index}
                className="flex items-start gap-2 sm:gap-3 py-2 sm:py-0 cursor-pointer transition-colors hover:opacity-80"
              >
                <div className="shrink-0 mt-1">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => handleToggle(index, checked === true)}
                    className="rounded data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background"
                  />
                </div>
                <span className="text-base sm:text-[17px] leading-6 sm:leading-7 text-foreground break-words flex-1">
                  {declaration}
                </span>
              </label>
            );
          })}
        </div>
      </div>
      
      <div>
        <div className="border rounded-xl p-4 sm:p-6 bg-card">
          <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-3 sm:mb-4">What happens next?</h3>
          <ul className="pl-4 md:pl-6 text-sm sm:text-base leading-5 sm:leading-6 text-foreground list-disc space-y-2">
            <li>Your application will be reviewed by our credit team.</li>
            <li>Documents will be verified for authenticity.</li>
            <li>You may be contacted for additional information.</li>
          </ul>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base leading-5 sm:leading-6 text-muted-foreground">
            Submitting this form legally binds your organization to the financing terms.
          </p>
        </div>
      </div>
    </div>
  );
}
