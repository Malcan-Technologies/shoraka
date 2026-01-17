"use client";

import * as React from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useProduct } from "@/hooks/use-product";
import { ProgressIndicator } from "@/components/progress-indicator";
import { BellIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import {
  useApplication,
  useValidateStep,
  useUpdateApplication,
  useSubmitApplication,
} from "@/hooks/use-applications";
import { toast } from "sonner";
import { getStepComponent } from "../new/step-components";

export default function ApplicationWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const applicationId = params.id as string;

  // Fetch application
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);

  // Extract productId from financingType
  const selectedProductId = application?.financingType?.productId || null;

  // Fetch the product to get its workflow
  const { data: selectedProduct } = useProduct(selectedProductId);

  // Extract workflow steps from selected product (with IDs)
  const workflowSteps = React.useMemo(() => {
    if (!selectedProduct || !(selectedProduct as any).workflow || !Array.isArray((selectedProduct as any).workflow)) {
      return [];
    }
    // Extract step info (id, name, config) from workflow
    return ((selectedProduct as any).workflow as any[]).map((step: any) => ({
      id: step.id || "",
      name: step.name || "Unknown Step",
      config: step.config || {},
    }));
  }, [selectedProduct]);

  const totalSteps = workflowSteps.length;

  // Get current step from URL, default to 1
  const currentStep = React.useMemo(() => {
    const stepParam = searchParams.get("step");
    const step = stepParam ? parseInt(stepParam, 10) : 1;
    return Math.max(1, Math.min(step, totalSteps || 1)); // Clamp between 1 and total steps
  }, [searchParams, totalSteps]);

  // Get current step info
  const currentStepInfo = workflowSteps[currentStep - 1];
  const currentStepId = currentStepInfo?.id || "";
  const currentStepName = currentStepInfo?.name || "Loading...";
  const currentStepConfig = currentStepInfo?.config || {};

  // Get the component for current step
  const StepComponent = getStepComponent(currentStepId);

  // Validate step access
  const { data: stepValidation } = useValidateStep(applicationId, currentStep);

  // Redirect to last allowed step if needed
  React.useEffect(() => {
    if (stepValidation && !stepValidation.allowed && stepValidation.lastAllowedStep !== currentStep) {
      router.replace(`/applications/${applicationId}?step=${stepValidation.lastAllowedStep}`);
    }
  }, [stepValidation, currentStep, applicationId, router]);

  // If submitted, redirect to view-only page (no step param)
  React.useEffect(() => {
    if (application && application.status !== "DRAFT" && searchParams.get("step")) {
      router.replace(`/applications/${applicationId}`);
    }
  }, [application, applicationId, router, searchParams]);

  const updateApplication = useUpdateApplication();
  const submitApplication = useSubmitApplication();

  // Update URL with new step
  const updateStep = React.useCallback((step: number) => {
    const params = new URLSearchParams();
    params.set("step", step.toString());
    router.push(`/applications/${applicationId}?${params.toString()}`);
  }, [router, applicationId]);

  const handleContinue = async () => {
    if (currentStep === 1 && !selectedProductId) {
      toast.error("Please select a financing type");
      return;
    }

    // Save step 1 data (productId) - this should already be saved, but update if changed
    if (currentStep === 1 && selectedProductId) {
      try {
        await updateApplication.mutateAsync({
          id: applicationId,
          input: {
            productId: selectedProductId,
          },
        });
        toast.success("Financing type updated");
      } catch (error) {
        toast.error("Failed to save", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        return;
      }
    }

    // Move to next step
    if (currentStep < totalSteps) {
      updateStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      updateStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      await submitApplication.mutateAsync(applicationId);
      toast.success("Application submitted successfully");
      // Redirect to view-only page (no step param)
      router.replace(`/applications/${applicationId}`);
    } catch (error) {
      toast.error("Failed to submit application", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Show loading while fetching application
  if (isLoadingApp) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading application...</p>
        </div>
      </div>
    );
  }

  // If application not found, show error
  if (!application) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Application not found</p>
          <Button onClick={() => router.push("/")}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  // If not in DRAFT, show read-only view (this should redirect, but just in case)
  if (application.status !== "DRAFT") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            Application has been {application.status.toLowerCase()}
          </p>
          <Button onClick={() => router.push("/")}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  // If no productId selected yet, show message
  if (!selectedProductId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No financing type selected</p>
          <Button onClick={() => router.push("/applications/new")}>Start New Application</Button>
        </div>
      </div>
    );
  }

  // If product is loading, show loading state
  if (!selectedProduct) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading product workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 sm:px-6">
        <SidebarTrigger />
        <div className="flex items-center gap-2 flex-1">
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <Button variant="ghost" size="icon" className="ml-auto">
            <BellIcon className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Title and Description */}
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">{currentStepName}</h2>
            {currentStep === 1 && (
              <p className="text-muted-foreground">
                Browse and invest in verified loan opportunities from your dashboard
              </p>
            )}
          </div>

          {/* Progress Indicator */}
          {workflowSteps.length > 0 && (
            <ProgressIndicator 
              steps={workflowSteps.map(s => s.name)} 
              currentStep={currentStep - 1} 
            />
          )}

          {/* Step Content - Dynamically render based on step ID */}
          {currentStepInfo && (
            <StepComponent
              stepId={currentStepId}
              stepName={currentStepName}
              stepConfig={currentStepConfig}
              applicationId={applicationId}
              selectedProductId={selectedProductId}
              onDataChange={(data) => {
                // Handle step data changes (for future steps)
                console.log("Step data changed:", data);
              }}
            />
          )}
        </div>
      </main>

      {/* Footer with Navigation Buttons */}
      <footer className="flex h-16 shrink-0 items-center justify-between gap-4 border-t px-4 sm:px-6">
        <div>
          {currentStep > 1 && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
        </div>
        <div>
          {currentStep < totalSteps ? (
            <Button
              onClick={handleContinue}
              disabled={currentStep === 1 && !selectedProductId}
              className="gap-2"
            >
              Save and continue
              <ArrowRightIcon className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitApplication.isPending}
              className="gap-2"
            >
              {submitApplication.isPending ? "Submitting..." : "Submit Application"}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
