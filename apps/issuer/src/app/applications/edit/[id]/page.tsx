"use client";

import * as React from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ProgressIndicator } from "@/components/progress-indicator";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { useApplication, useUpdateApplicationStep, useArchiveApplication } from "@/hooks/use-applications";
import { useProducts } from "@/hooks/use-products";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FinancingTypeStep } from "../../steps/financing-type-step";
import { VerifyCompanyInfoStep } from "../../steps/verify-company-info-step";
import { SupportingDocumentsStep } from "../../steps/supporting-documents-step";
import { DeclarationsStep } from "../../steps/declarations-step";
import { VersionMismatchModal } from "../../components/version-mismatch-modal";


// We'll implement these step components next
// For now, we'll use placeholders
const StepPlaceholder = ({ title }: { title: string }) => (
  <div className="text-center py-20 text-muted-foreground">
    {title} implementation coming soon...
  </div>
);

const STEP_MAP: Record<string, React.ComponentType<any>> = {
  "financing_type": FinancingTypeStep,
  "verify_company_info": VerifyCompanyInfoStep,
  "company_info": VerifyCompanyInfoStep, // delete later
  "supporting_documents": SupportingDocumentsStep,
  "declaration": DeclarationsStep,
  "declarations": DeclarationsStep,
};

export default function EditApplicationPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  
  // URL uses 1-based indexing for users (step=1, step=2, etc.)
  const currentStepDisplay = parseInt(searchParams.get("step") || "1");
  // Code uses 0-based indexing for arrays (0, 1, 2, etc.)
  const currentStepIndex = currentStepDisplay - 1;

  const { data: application, isLoading: isLoadingApp, isError } = useApplication(id);
  const { data: productsData, isLoading: isLoadingProducts } = useProducts({
    page: 1,
    pageSize: 100,
  });
  
  const [selectedProductId, setSelectedProductId] = React.useState<string>("");

  const products = productsData?.products || [];

  // Use selectedProductId if user changed it, otherwise use from DB
  const effectiveProductId = selectedProductId || application?.financing_type?.product_id;
  
  // Find the selected product from the list
  const selectedProduct = React.useMemo(() => {
    return products.find((p: any) => p.id === effectiveProductId);
  }, [products, effectiveProductId]);

  const updateStepMutation = useUpdateApplicationStep();
  const archiveApplicationMutation = useArchiveApplication();

  const [isUnsavedChangesModalOpen, setIsUnsavedChangesModalOpen] = React.useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [isVersionMismatchModalOpen, setIsVersionMismatchModalOpen] = React.useState(false);
  const [areAllFilesUploaded, setAreAllFilesUploaded] = React.useState(true);
  const [areAllDeclarationsChecked, setAreAllDeclarationsChecked] = React.useState(true);
  const [declarationsData, setDeclarationsData] = React.useState<any>(null);
  const declarationsDataRef = React.useRef<any>(null);
  
  // Reset unsaved changes when step changes
  React.useEffect(() => {
    setHasUnsavedChanges(false);
    setAreAllFilesUploaded(true);
    setAreAllDeclarationsChecked(true);
    setDeclarationsData(null);
    declarationsDataRef.current = null;
  }, [currentStepDisplay]);
  
  // Workflow steps from the application's product
  const workflowSteps = React.useMemo(() => {
    return (selectedProduct as any)?.workflow?.map((step: any) => step.name) || [];
  }, [selectedProduct]);

  // Helper to get the base step ID (strips unique suffixes like _abc)
  const getBaseStepId = (stepId: string) => {
    if (!stepId) return "";
    // If the ID has underscores, we take everything except the last part
    const parts = stepId.split("_");
    if (parts.length > 1) {
      return parts.slice(0, -1).join("_");
    }
    return stepId;
  };

  const currentStepId = (selectedProduct as any)?.workflow?.[currentStepIndex]?.id;
  const baseStepId = getBaseStepId(currentStepId);
  const StepComponent = STEP_MAP[baseStepId];
  const currentStepConfig = (selectedProduct as any)?.workflow?.[currentStepIndex]?.config;

  // Sync selectedProductId with application data
  React.useEffect(() => {
    if (application?.financing_type?.product_id) {
      setSelectedProductId(application.financing_type.product_id);
    }
  }, [application]);

  // Handle resume logic
  React.useEffect(() => {
    if (application && !searchParams.get("step")) {
      const resumeStep = application.last_completed_step || 1;
      router.replace(`/applications/edit/${id}?step=${resumeStep}`);
    }
  }, [application, id, router, searchParams]);

  // Handle version mismatch
  React.useEffect(() => {
    if (application?.isVersionMismatch) {
      setIsVersionMismatchModalOpen(true);
    }
  }, [application?.isVersionMismatch]);

  const handleRestart = async () => {
    try {
      await archiveApplicationMutation.mutateAsync(id);
      router.push("/applications/new");
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Handle unsaved changes warning for browser navigation (reload, close tab)
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle unsaved changes for internal navigation (sidebar, back button, etc.)
  React.useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor && anchor.href && !anchor.href.includes(window.location.pathname)) {
        e.preventDefault();
        setIsUnsavedChangesModalOpen(true);
        // Store the destination to navigate after user confirms
        (window as any)._pendingNavigation = anchor.href;
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [hasUnsavedChanges]);

  const handleConfirmLeave = () => {
    setHasUnsavedChanges(false);
    setIsUnsavedChangesModalOpen(false);
    const pendingNav = (window as any)._pendingNavigation;
    setTimeout(() => {
    if (pendingNav) {
      router.push(pendingNav);
      (window as any)._pendingNavigation = null;
    } else if (currentStepDisplay > 1) {
      router.push(`/applications/edit/${id}?step=${currentStepDisplay - 1}`);
    } else {
      router.push("/dashboard");
    }
  }, 0)
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      setIsUnsavedChangesModalOpen(true);
    } else if (currentStepDisplay > 1) {
      router.push(`/applications/edit/${id}?step=${currentStepDisplay - 1}`);
    } else {
      router.push("/dashboard");
    }
  };

  // Handle browser back button
  React.useEffect(() => {
    if (!hasUnsavedChanges) return;

    // Push a dummy state to the history so we can catch the popstate event
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      // If there are unsaved changes, prevent the back navigation
      if (hasUnsavedChanges) {
        // Re-push the dummy state to keep the user on the current page
        window.history.pushState(null, "", window.location.href);
        setIsUnsavedChangesModalOpen(true);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hasUnsavedChanges]);

  const handleSaveAndContinue = async (data: any) => {
    try {
      // If there's a step-specific save function (for verify_company_info or supporting_documents step), call it first
      const stepSaveFunction = (window as any)._stepSaveFunction;
      if (stepSaveFunction) {
        const stepData = await stepSaveFunction();
        // stepData can be null (for verify_company_info which saves directly to organization)
        // or an object (for supporting_documents which returns { categories: [...] } directly)
        if (stepData && typeof stepData === 'object') {
          // The step returns dataToSave directly (e.g., { categories: [...] })
          // The backend will save it to the supporting_documents field
          await updateStepMutation.mutateAsync({
            id,
            stepData: {
              stepIndex: currentStepIndex,
              data: stepData,
            },
          });
        }
        (window as any)._stepSaveFunction = null;
      } else {
        // Get the base step ID to determine which field to save to
        const baseStepId = getBaseStepId(workflowSteps[currentStepIndex]);
        
        console.log("Save and continue clicked:", {
          baseStepId,
          currentStepDisplay,
          currentStepIndex,
          declarationsData,
          workflowStep: workflowSteps[currentStepIndex],
          workflowStepsLength: workflowSteps.length,
        });
        
        let finalData;
        if (currentStepDisplay === 1) {
          // Step 1: Save product_id
          finalData = { product_id: selectedProductId };
        } else if (baseStepId.toLowerCase() === "declaration" || baseStepId.toLowerCase() === "declarations") {
          // Declaration step: Save declarations data
          const currentDeclarationsData = declarationsData || declarationsDataRef.current;
          
          console.log("Declaration step - preparing to save:", {
            declarationsData,
            declarationsDataRef: declarationsDataRef.current,
            currentDeclarationsData,
            currentStepIndex,
            currentStepConfig,
          });
          
          if (currentDeclarationsData && currentDeclarationsData.declarations) {
            console.log("Saving declarations to DB:", currentDeclarationsData);
            finalData = currentDeclarationsData;
          } else {
            // If no data from component, build it from stepConfig with all unchecked
            const declarations = currentStepConfig?.declarations || [];
            finalData = {
              declarations: declarations.map(() => ({ checked: false })),
            };
            console.log("Built declarations data from stepConfig (fallback):", finalData);
          }
        } else {
          // Other steps
          finalData = data;
        }
        
        if (!finalData) {
          console.error("No data to save for step:", baseStepId);
          return;
        }
        
        console.log("Final data being saved:", {
          stepIndex: currentStepIndex,
          data: finalData,
          baseStepId,
        });
        
        await updateStepMutation.mutateAsync({
          id,
          stepData: {
            stepIndex: currentStepIndex,
            data: finalData,
          },
        });
        
        console.log("Save completed successfully");
      }
      
      setHasUnsavedChanges(false);
      
      console.log("Navigation check:", {
        currentStepDisplay,
        workflowStepsLength: workflowSteps.length,
        willNavigate: currentStepDisplay < workflowSteps.length,
        nextStep: currentStepDisplay < workflowSteps.length ? currentStepDisplay + 1 : null,
      });
      
      if (currentStepDisplay < workflowSteps.length) {
        router.push(`/applications/edit/${id}?step=${currentStepDisplay + 1}`);
      } else {
        toast.success("Application submitted successfully!");
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error in handleSaveAndContinue:", error);
    }
  };

  if (isLoadingApp || isLoadingProducts) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Skeleton className="h-6 w-32" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 pt-0">
          <div className="flex flex-1 flex-col gap-4">
            <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8">
              <div className="mb-6">
                <Skeleton className="h-9 w-64 mb-2" />
                <Skeleton className="h-5 w-96" />
              </div>

              <ProgressIndicator
                steps={Array(7).fill("")}
                currentStep={1}
                isLoading={true}
              />
            </div>

            <div className="h-px bg-border w-full -mx-4" />

            <div className="max-w-7xl mx-auto w-full px-2 md:px-4 pt-6">
              <FinancingTypeStep 
                selectedProductId=""
                onProductSelect={() => {}}
                isLoading={true}
              />
            </div>
          </div>
        </main>

        <footer className="sticky bottom-0 border-t bg-background z-10 mt-auto">
          <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-4 flex justify-between gap-4">
            <Skeleton className="h-12 w-24 rounded-xl" />
            <Skeleton className="h-12 w-40 rounded-xl" />
          </div>
        </footer>
      </div>
    );
  }

  if (isError || !application) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <h2 className="text-2xl font-bold">Application not found</h2>
        <Button onClick={() => router.push("/dashboard")} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">
          {(selectedProduct as any)?.name || "Application"}
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pt-0">
        <div className="flex flex-1 flex-col gap-4">
          <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8">
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                {workflowSteps[currentStepIndex]}
              </h1>
            </div>

            <ProgressIndicator
              steps={workflowSteps.length > 0 ? workflowSteps : Array(7).fill("")}
              currentStep={currentStepDisplay}
              isLoading={false}
            />
          </div>

          <div className="h-px bg-border w-full -mx-4" />

          <div className="max-w-7xl mx-auto w-full px-2 md:px-4 pt-6">
            {StepComponent ? (
              <StepComponent 
                // Step 1 props
                selectedProductId={selectedProductId}
                onProductSelect={(pid: string) => {
                  setSelectedProductId(pid);
                  setHasUnsavedChanges(pid !== application.financing_type?.product_id);
                }}
                isLoading={false}
                // Supporting documents props
                applicationId={id}
                stepConfig={currentStepConfig}
                // Step data change handler
                onDataChange={(data: any) => {
                  if (data?.hasPendingChanges) {
                    setHasUnsavedChanges(true);
                  }
                  if (data?.saveFunction) {
                    (window as any)._stepSaveFunction = data.saveFunction;
                  }
                  if (data?.areAllFilesUploaded !== undefined) {
                    setAreAllFilesUploaded(data.areAllFilesUploaded);
                  }
                  if (data?.areAllDeclarationsChecked !== undefined) {
                    setAreAllDeclarationsChecked(data.areAllDeclarationsChecked);
                  }
                  if (data?.declarations !== undefined) {
                    setDeclarationsData(data.declarations);
                    declarationsDataRef.current = data.declarations;
                  }
                }}
              />
            ) : (
              <StepPlaceholder title={workflowSteps[currentStepIndex]} />
            )}
          </div>
        </div>
      </main>

      <footer className="sticky bottom-0 border-t bg-background z-10 mt-auto">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-4 flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            className="text-base md:text-[17px] font-semibold px-4 md:px-6 py-2.5 md:py-3 rounded-xl"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={() => handleSaveAndContinue({})}
            disabled={
              updateStepMutation.isPending || 
              (currentStepDisplay === 1 && !selectedProductId) ||
              (baseStepId === "supporting_documents" && !areAllFilesUploaded) ||
              ((baseStepId.toLowerCase() === "declaration" || baseStepId.toLowerCase() === "declarations") && !areAllDeclarationsChecked)
            }
            className="bg-primary text-primary-foreground hover:opacity-95 shadow-brand text-base md:text-[17px] font-semibold px-4 md:px-6 py-2.5 md:py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateStepMutation.isPending 
              ? "Saving..." 
              : currentStepDisplay === workflowSteps.length 
                ? "Submit Application" 
                : "Save and continue"}
            <ArrowRightIcon className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </footer>

      {/* Unsaved Changes Dialog */}
      <Dialog open={isUnsavedChangesModalOpen} onOpenChange={setIsUnsavedChangesModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUnsavedChangesModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmLeave}
            >
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version Mismatch Modal */}
      <VersionMismatchModal
        open={isVersionMismatchModalOpen}
        onConfirm={handleRestart}
        isPending={archiveApplicationMutation.isPending}
      />
    </div>
  );
}
