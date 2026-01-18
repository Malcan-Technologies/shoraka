"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-products";
import { useProduct } from "@/hooks/use-product";
import { useCreateDraftApplication, useUpdateApplication, useApplication } from "@/hooks/use-applications";
import { ProgressIndicator } from "@/components/progress-indicator";
import { BellIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { getStepComponent } from "./step-components";
import type { Product, FinancingType, ProductsResponse, WorkflowStepInfo } from "./types";
import { hasProducts, hasWorkflow, extractFinancingType, toWorkflowStepInfo } from "./helpers";

export default function NewApplicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Fetch all products (financing types) from the API
  const { data: productsData } = useProducts({
    page: 1,
    pageSize: 100,
  });

  /**
   * Transform products from API into financing types for display
   * 
   * This takes the raw product data and extracts just the information
   * we need to show the financing type cards (name, description, image)
   */
  const financingTypes = React.useMemo((): FinancingType[] => {
    // If we don't have data yet, return empty array
    if (!productsData) {
      return [];
    }

    // Check if the response has products
    if (!hasProducts(productsData)) {
      return [];
    }

    // Convert each product to a financing type
    const response = productsData as ProductsResponse;
    return response.products.map((product: Product) => {
      return extractFinancingType(product);
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

  /**
   * Extract workflow steps from the selected product
   * 
   * This takes the product's workflow and converts it into a simpler format
   * that we can use to display the progress indicator and step names
   * 
   * useMemo prevents recalculating this every render - only recalculates when selectedProduct changes
   */
  const workflowSteps = React.useMemo((): WorkflowStepInfo[] => {
    // If we don't have a product or it doesn't have a workflow, return empty array
    if (!selectedProduct || !hasWorkflow(selectedProduct)) {
      return [];
    }

    // Convert each step to step info
    const product = selectedProduct as Product;
    return product.workflow.map((step) => toWorkflowStepInfo(step));
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
  
  // Fetch application if it exists (to check if product changed)
  const { data: existingApplication } = useApplication(applicationId);
  const existingProductId = existingApplication?.financingType?.productId || null;

  // Track step data from onDataChange
  // This stores data from each step before saving
  const [stepData, setStepData] = React.useState<Record<string, unknown>>({});

  // Handle data changes from step components
  const handleStepDataChange = React.useCallback((data: Record<string, unknown>) => {
    // Handle product selection changes from step 1
    // When user selects a different product, update selectedProductId
    // This will trigger workflow steps to update
    if (data.productId && typeof data.productId === "string") {
      setSelectedProductId(data.productId);
    } else {
      // Handle other step data changes
      // Store the data so we can save it when user clicks "Save and continue"
      setStepData(data);
    }
  }, []);

  // Update URL with new step
  // If we have an applicationId, use /applications/{id}?step=X
  // Otherwise, use /applications/new?step=X
  // 
  // Note: applicationId can be passed directly if we just created it (to avoid stale closure)
  const updateStep = React.useCallback((step: number, overrideApplicationId?: string) => {
    const params = new URLSearchParams();
    params.set("step", step.toString());
    
    // Use overrideApplicationId if provided, otherwise use state applicationId
    const appId = overrideApplicationId || applicationId;
    
    if (appId) {
      router.push(`/applications/${appId}?${params.toString()}`);
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
      let appIdForNavigation = applicationId; // Track which ID to use for navigation
      
      if (currentStep === 1) {
        if (!applicationId) {
          // Create draft application first
          const newApplication = await createDraft.mutateAsync({});
          setApplicationId(newApplication.id);
          appIdForNavigation = newApplication.id; // Use the new ID for navigation
          
          // Then save the productId to financing_type
          await updateApplication.mutateAsync({
            id: newApplication.id,
            input: {
              productId: selectedProductId!,
            },
          });
          toast.success("Financing type saved");
        } else {
          // Update existing application
          // Check if user selected a different product
          const productHasChanged = selectedProductId !== existingProductId;
          
          // Prepare the data to send to the API
          let inputToSend: any = {
            productId: selectedProductId!,
          };
          
          // If product changed, also clear all the old step data
          if (productHasChanged) {
            inputToSend.data = {
              financingTerms: null,
              invoiceDetails: null,
              companyInfo: null,
              supportingDocuments: null,
              declaration: null,
            };
          }
          
          // Send the update to the API
          await updateApplication.mutateAsync({
            id: applicationId,
            input: inputToSend,
          });
          
          // Show a message to the user
          if (productHasChanged) {
            toast.success("Financing type updated. All previous data has been cleared.");
          } else {
            toast.success("Financing type updated");
          }
        }
      } else {
        // Save data for other steps (step 2, 3, 4, 5, etc.)
        // stepData contains data from onDataChange callback
        if (!appIdForNavigation) {
          toast.error("Application not found. Please refresh the page.");
          return;
        }

        // Check if there are files to upload (for supporting documents step)
        // The component exposes _uploadFiles function in stepData
        if (stepData._uploadFiles && typeof stepData._uploadFiles === "function") {
          try {
            // Upload files to S3 first
            await (stepData._uploadFiles as () => Promise<void>)();
          } catch (error) {
            toast.error("Failed to upload files", {
              description: error instanceof Error ? error.message : "Unknown error",
            });
            return; // Don't save if upload fails
          }
        }

        // Remove internal functions from stepData before saving
        const dataToSave = { ...stepData };
        delete (dataToSave as any)._uploadFiles;

        if (Object.keys(dataToSave).length > 0) {
          await updateApplication.mutateAsync({
            id: appIdForNavigation,
            input: {
              data: dataToSave,
            },
          });
          
          toast.success("Data saved successfully");
        }
      }

      // Move to next step (only if there are more steps)
      if (currentStep < totalSteps) {
        // Pass the application ID (either existing or newly created) to updateStep
        updateStep(currentStep + 1, appIdForNavigation || undefined);
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
              onDataChange={handleStepDataChange}
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
