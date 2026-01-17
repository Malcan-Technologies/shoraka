"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-products";
import { useProduct } from "@/hooks/use-product";
import { useCreateDraftApplication, useUpdateApplication } from "@/hooks/use-applications";
import { ProgressIndicator } from "@/components/progress-indicator";
import { BellIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { getStepComponent } from "./step-components";

export default function NewApplicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Fetch all products (financing types) - only needed for step 1, but keeping for now
  const { data: productsData } = useProducts({
    page: 1,
    pageSize: 100,
  });

  // Transform products to financing types
  const financingTypes = React.useMemo(() => {
    if (!productsData || !(productsData as any).products) {
      return [];
    }

    return ((productsData as any).products as any[]).map((product: any) => {
      const workflow = product.workflow || [];
      
      // Find Financing Type step to get name, description, category, and image
      const financingStep = workflow.find(
        (step: any) => step.name?.toLowerCase().includes("financing type")
      );
      const config = financingStep?.config || {};

      return {
        id: product.id,
        name: config.name || "Unknown",
        description: config.description || "",
        category: config.category || "",
        s3Key: config.s3_key || null,
        fileName: config.file_name || null,
      };
    });
  }, [productsData]);

  // Get first product ID as default
  const defaultProductId = React.useMemo(() => {
    if (financingTypes.length > 0) {
      return financingTypes[0].id;
    }
    return null;
  }, [financingTypes]);

  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);

  // Sync selectedProductId with default when products load
  React.useEffect(() => {
    if (defaultProductId && !selectedProductId) {
      setSelectedProductId(defaultProductId);
    }
  }, [defaultProductId, selectedProductId]);

  // Use selected product ID or default to first product
  const activeProductId = selectedProductId || defaultProductId;

  // Fetch the selected product to get its workflow
  const { data: selectedProduct } = useProduct(activeProductId);

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

  // Application state
  const [applicationId, setApplicationId] = React.useState<string | null>(null);
  const createDraft = useCreateDraftApplication();
  const updateApplication = useUpdateApplication();

  // Update URL with new step
  // If we have an applicationId, use /applications/{id}?step=X
  // Otherwise, use /applications/new?step=X
  const updateStep = React.useCallback((step: number) => {
    const params = new URLSearchParams();
    params.set("step", step.toString());
    
    if (applicationId) {
      router.push(`/applications/${applicationId}?${params.toString()}`);
    } else {
      router.push(`/applications/new?${params.toString()}`);
    }
  }, [router, applicationId]);

  const handleContinue = async () => {
    if (currentStep === 1 && !selectedProductId) {
      toast.error("Please select a financing type");
      return;
    }

    try {
      // Step 1: Create draft application if it doesn't exist, then save productId
      if (currentStep === 1) {
        if (!applicationId) {
          // Create draft application first
          const newApplication = await createDraft.mutateAsync({});
          setApplicationId(newApplication.id);
          
          // Then save the productId to financing_type
          await updateApplication.mutateAsync({
            id: newApplication.id,
            input: {
              productId: selectedProductId!,
            },
          });
          toast.success("Financing type saved");
          
          // Redirect to /applications/{id}?step=2 after creating draft
          if (currentStep < totalSteps) {
            const params = new URLSearchParams();
            params.set("step", (currentStep + 1).toString());
            router.push(`/applications/${newApplication.id}?${params.toString()}`);
            return; // Exit early to prevent double navigation
          }
        } else {
          // Update existing application
          await updateApplication.mutateAsync({
            id: applicationId,
            input: {
              productId: selectedProductId!,
            },
          });
          toast.success("Financing type updated");
        }
      }

      // Move to next step
      if (currentStep < totalSteps) {
        updateStep(currentStep + 1);
      }
    } catch (error) {
      toast.error("Failed to save", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      updateStep(currentStep - 1);
    }
  };

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
            <Button className="gap-2">
              Submit Application
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
