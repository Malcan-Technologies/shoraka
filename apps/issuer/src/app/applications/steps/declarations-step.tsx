"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useApplication } from "@/hooks/use-applications";

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

  const declarations = React.useMemo(() => {
    const decls = stepConfig?.declarations;
    return Array.isArray(decls) ? decls : [];
  }, [stepConfig?.declarations]);
  const [checkedDeclarations, setCheckedDeclarations] = React.useState<Record<number, boolean>>({});
  const onDataChangeRef = React.useRef(onDataChange);

  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  const [isInitialized, setIsInitialized] = React.useState(false);

  React.useEffect(() => {
    if (!application || declarations.length === 0) {
      return;
    }

    const savedDeclarations = application.declarations as any;
    
    console.log("Loading declarations from DB:", {
      savedDeclarations,
      declarationsLength: declarations.length,
      hasSavedData: !!savedDeclarations,
    });
    
    const initialState: Record<number, boolean> = {};
    
    if (savedDeclarations?.declarations && Array.isArray(savedDeclarations.declarations)) {
      savedDeclarations.declarations.forEach((item: any, index: number) => {
        if (index < declarations.length) {
          initialState[index] = item.checked || false;
        }
      });
      console.log("Loaded from saved data:", initialState);
    } else {
      declarations.forEach((_: any, index: number) => {
        initialState[index] = false;
      });
      console.log("Initialized with false values:", initialState);
    }
    
    setCheckedDeclarations(initialState);
    setIsInitialized(true);
  }, [application, declarations]);

  React.useEffect(() => {
    if (!onDataChangeRef.current || declarations.length === 0 || !isInitialized) return;

    const dataToSave = declarations.map((_: any, index: number) => ({
      checked: checkedDeclarations[index] || false,
    }));

    const allChecked = declarations.every((_: any, index: number) => 
      checkedDeclarations[index] === true
    );

    const saveData = {
      declarations: dataToSave,
    };

    console.log("Sending declarations data to parent:", saveData);

    onDataChangeRef.current({
      areAllDeclarationsChecked: allChecked,
      declarations: saveData,
    });
  }, [checkedDeclarations, declarations, isInitialized]);

  const handleToggle = React.useCallback((index: number, checked: boolean) => {
    setCheckedDeclarations((prev) => ({
      ...prev,
      [index]: checked,
    }));
  }, []);

  if (isLoadingApp || !stepConfig) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div>
          <div className="border rounded-xl p-6 bg-card">
            <div>
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 py-3"
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
          <div className="border rounded-xl p-6 bg-card">
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
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
      <div>
        <div className="border rounded-xl p-6 bg-card space-y-6">
          {declarations.map((declaration: string, index: number) => {
            const isChecked = checkedDeclarations[index] || false;

            return (
              <label
                key={index}
                className="flex items-start gap-3 cursor-pointer transition-colors hover:opacity-80"
              >
                <div className="shrink-0 mt-1">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => handleToggle(index, checked === true)}
                    className="rounded data-[state=checked]:bg-foreground data-[state=checked]:border-foreground data-[state=checked]:text-background"
                  />
                </div>
                <span className="text-[17px] leading-7 text-foreground break-words flex-1">
                  {declaration}
                </span>
              </label>
            );
          })}
        </div>
      </div>
      
      <div>
        <div className="border rounded-xl p-6 bg-card">
          <h3 className="text-lg md:text-xl font-semibold mb-4">What happens next?</h3>
          <ul className="pl-4 md:pl-6 text-sm md:text-base leading-6 text-foreground list-disc space-y-2">
            <li>Your application will be reviewed by our credit team.</li>
            <li>Documents will be verified for authenticity.</li>
            <li>You may be contacted for additional information.</li>
          </ul>
          <p className="mt-4 text-sm md:text-base leading-6 text-muted-foreground">
            Submitting this form legally binds your organization to the financing terms.
          </p>
        </div>
      </div>
    </div>
  );
}
