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
import { VersionMismatchModal } from "../../components/version-mismatch-modal";


// We'll implement these step components next
// For now, we'll use placeholders
const StepPlaceholder = ({ title }: { title: string }) => (
  <div className="text-center py-20 text-muted-foreground">
    {title} implementation coming soon...
  </div>
);

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
  
  // Workflow steps from the application's product
  const workflowSteps = React.useMemo(() => {
    return (selectedProduct as any)?.workflow?.map((step: any) => step.name) || [];
  }, [selectedProduct]);

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
    if (pendingNav) {
      router.push(pendingNav);
      (window as any)._pendingNavigation = null;
    } else if (currentStepDisplay > 1) {
      router.push(`/applications/edit/${id}?step=${currentStepDisplay - 1}`);
    } else {
      router.push("/dashboard");
    }
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

    const handlePopState = (e: PopStateEvent) => {
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
      // If we are on Step 1, we save the product_id
      const finalData = currentStepDisplay === 1 
        ? { product_id: selectedProductId }
        : data;

      await updateStepMutation.mutateAsync({
        id,
        stepData: {
          stepIndex: currentStepIndex,
          data: finalData,
        },
      });
      
      setHasUnsavedChanges(false);
      
      if (currentStepDisplay < workflowSteps.length) {
        router.push(`/applications/edit/${id}?step=${currentStepDisplay + 1}`);
      } else {
        toast.success("Application submitted successfully!");
        router.push("/dashboard");
      }
    } catch (error) {
      // Error handled by mutation
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
          {selectedProduct?.name || "Application"}
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
            {currentStepDisplay === 1 ? (
              <FinancingTypeStep 
                selectedProductId={selectedProductId}
                onProductSelect={(pid) => {
                  setSelectedProductId(pid);
                  setHasUnsavedChanges(pid !== application.financing_type?.product_id);
                }}
                isLoading={false}
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
            disabled={updateStepMutation.isPending || (currentStepDisplay === 1 && !selectedProductId)}
            className="bg-primary text-primary-foreground hover:opacity-95 shadow-brand text-base md:text-[17px] font-semibold px-4 md:px-6 py-2.5 md:py-3 rounded-xl"
          >
            {updateStepMutation.isPending ? "Saving..." : "Save and continue"}
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
