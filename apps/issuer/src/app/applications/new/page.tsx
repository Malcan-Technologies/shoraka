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
import type { Product, ProductsResponse } from "./types";
import { hasProducts, hasWorkflow, extractFinancingType, toWorkflowStepInfo } from "./helpers";

export default function NewApplicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: productsData } = useProducts({
    page: 1,
    pageSize: 100,
  });

  const financingTypes = React.useMemo(() => {
    if (!productsData) {
      return [];
    }

    if (!hasProducts(productsData)) {
      return [];
    }

    const response = productsData as ProductsResponse;
    return response.products.map((product: Product) => {
      return extractFinancingType(product);
    });
  }, [productsData]);

  const defaultProductId = React.useMemo(() => {
    if (financingTypes.length > 0) {
      return financingTypes[0].id;
    }
    return null;
  }, [financingTypes]);

  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (defaultProductId && !selectedProductId) {
      setSelectedProductId(defaultProductId);
    }
  }, [defaultProductId, selectedProductId]);

  const activeProductId = selectedProductId || defaultProductId;

  const { data: selectedProduct } = useProduct(activeProductId);

  const workflowSteps = React.useMemo(() => {
    if (!selectedProduct || !hasWorkflow(selectedProduct)) {
      return [];
    }

    const product = selectedProduct as Product;
    return product.workflow.map((step) => toWorkflowStepInfo(step));
  }, [selectedProduct]);

  const totalSteps = workflowSteps.length;

  const currentStep = React.useMemo(() => {
    const stepParam = searchParams.get("step");
    const step = stepParam ? parseInt(stepParam, 10) : 1;
    return Math.max(1, Math.min(step, totalSteps || 1));
  }, [searchParams, totalSteps]);

  const currentStepInfo = workflowSteps[currentStep - 1];
  const currentStepId = currentStepInfo?.id || "";
  const currentStepName = currentStepInfo?.name || "Loading...";
  const currentStepConfig = currentStepInfo?.config || {};

  const StepComponent = getStepComponent(currentStepId);

  const [applicationId, setApplicationId] = React.useState<string | null>(null);
  const createDraft = useCreateDraftApplication();
  const updateApplication = useUpdateApplication();
  
  const { data: existingApplication } = useApplication(applicationId);
  const existingProductId = existingApplication?.financingType?.productId || null;

  const [stepData, setStepData] = React.useState<Record<string, unknown>>({});

  const handleStepDataChange = React.useCallback((data: Record<string, unknown>) => {
    if (data.productId && typeof data.productId === "string") {
      setSelectedProductId(data.productId);
    } else {
      setStepData(data);
    }
  }, []);

  const updateStep = React.useCallback((step: number, overrideApplicationId?: string) => {
    const params = new URLSearchParams();
    params.set("step", step.toString());
    
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

    let appIdForNavigation = applicationId;

    try {
      if (currentStep === 1) {
        if (!applicationId) {
          const newApplication = await createDraft.mutateAsync({});
          setApplicationId(newApplication.id);
          appIdForNavigation = newApplication.id;
          
          await updateApplication.mutateAsync({
            id: newApplication.id,
            input: {
              productId: selectedProductId!,
            },
          });
          toast.success("Financing type saved");
        } else {
          const productHasChanged = selectedProductId !== existingProductId;
          
          const inputToSend: Record<string, unknown> = {
            productId: selectedProductId!,
          };
          
          if (productHasChanged) {
            inputToSend.data = {
              financingTerms: null,
              invoiceDetails: null,
              companyInfo: null,
              supportingDocuments: null,
              declaration: null,
            };
          }
          
          await updateApplication.mutateAsync({
            id: applicationId,
            input: inputToSend,
          });
          
          if (productHasChanged) {
            toast.success("Financing type updated. All previous data has been cleared.");
          } else {
            toast.success("Financing type updated");
          }
        }
      } else {
        if (!appIdForNavigation) {
          toast.error("Application not found. Please refresh the page.");
          return;
        }

        let dataToSave = { ...stepData };
        
        if (stepData._uploadFiles && typeof stepData._uploadFiles === "function") {
          try {
            const uploadResult = await (stepData._uploadFiles as () => Promise<{ supportingDocuments: unknown } | null>)();
            
            if (uploadResult) {
              dataToSave = {
                ...dataToSave,
                ...uploadResult,
              };
            }
          } catch (error) {
            toast.error("Failed to upload files", {
              description: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        delete (dataToSave as Record<string, unknown>)._uploadFiles;

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
    } catch (error) {
      toast.error("Failed to save", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }

    if (currentStep < totalSteps) {
      const nextStep = currentStep + 1;
      const params = new URLSearchParams();
      params.set("step", nextStep.toString());
      
      const appId = appIdForNavigation || applicationId;
      
      if (appId) {
        router.push(`/applications/${appId}?${params.toString()}`);
      } else {
        router.push(`/applications/new?${params.toString()}`);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      updateStep(currentStep - 1);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <div className="flex items-center gap-2 flex-1">
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <Button variant="ghost" size="icon" className="ml-auto">
            <BellIcon className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pt-0">
        <div className="flex flex-1 flex-col gap-4 p-2 md:p-4">
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">{currentStepName}</h2>
              {currentStep === 1 && (
                <p className="text-muted-foreground">
                  Browse and invest in verified loan opportunities from your dashboard
                </p>
              )}
            </div>

            {workflowSteps.length > 0 && (
              <ProgressIndicator 
                steps={workflowSteps.map(s => s.name)} 
                currentStep={currentStep - 1} 
              />
            )}

            {currentStepInfo ? (
              <StepComponent
                stepId={currentStepId}
                stepName={currentStepName}
                stepConfig={currentStepConfig}
                applicationId={applicationId}
                selectedProductId={selectedProductId}
                onDataChange={handleStepDataChange}
              />
            ) : (
              <StepComponent
                stepId={currentStepId || "unknown"}
                stepName={currentStepName}
                stepConfig={{}}
                applicationId={applicationId}
                selectedProductId={selectedProductId}
                onDataChange={handleStepDataChange}
              />
            )}
          </div>
        </div>
      </main>

      <footer className="flex h-16 shrink-0 items-center justify-between gap-4 border-t px-4">
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
