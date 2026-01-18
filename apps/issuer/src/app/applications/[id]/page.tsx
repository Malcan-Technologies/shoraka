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
  useUpdateApplication,
  useSubmitApplication,
} from "@/hooks/use-applications";
import { toast } from "sonner";
import { getStepComponent } from "../new/step-components";
import type { Product } from "../new/types";
import { hasWorkflow, toWorkflowStepInfo } from "../new/helpers";

export default function ApplicationWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const applicationId = params.id as string;

  const { data: application, isLoading: isLoadingApp, refetch: refetchApplication } = useApplication(applicationId);

  const applicationProductId = application?.financingType?.productId || null;

  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [hasRefetched, setHasRefetched] = React.useState(false);

  React.useEffect(() => {
    if (applicationProductId) {
      setSelectedProductId(applicationProductId);
    }
  }, [applicationProductId]);

  React.useEffect(() => {
    if (application && !applicationProductId && !hasRefetched && !isLoadingApp) {
      const timeoutId = setTimeout(() => {
        refetchApplication();
        setHasRefetched(true);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [application, applicationProductId, hasRefetched, isLoadingApp, refetchApplication]);

  const activeProductId = selectedProductId || applicationProductId;

  const { data: selectedProduct } = useProduct(activeProductId);

  const workflowSteps = React.useMemo(() => {
    if (!selectedProduct) {
      return [];
    }

    if (!hasWorkflow(selectedProduct)) {
      return [];
    }

    const product = selectedProduct as Product;
    return product.workflow.map((step) => {
      return toWorkflowStepInfo(step);
    });
  }, [selectedProduct]);

  const totalSteps = workflowSteps.length;

  const currentStep = React.useMemo(() => {
    const stepParam = searchParams.get("step");
    const step = stepParam ? parseInt(stepParam, 10) : 1;
    return Math.max(1, Math.min(step, totalSteps || 1));
  }, [searchParams, totalSteps]);

  React.useEffect(() => {
    if (currentStep === 1 && selectedProductId && selectedProductId !== applicationProductId) {
      if (searchParams.get("step") !== "1") {
        router.replace(`/applications/${applicationId}?step=1`);
      }
    }
  }, [selectedProductId, applicationProductId, currentStep, applicationId, router, searchParams]);

  const currentStepInfo = workflowSteps[currentStep - 1];
  const currentStepId = currentStepInfo?.id || "";
  const currentStepName = currentStepInfo?.name || "Loading...";
  const currentStepConfig = currentStepInfo?.config || {};

  const StepComponent = getStepComponent(currentStepId);

  React.useEffect(() => {
    if (application && application.status !== "DRAFT" && searchParams.get("step")) {
      router.replace(`/applications/${applicationId}`);
    }
  }, [application, applicationId, router, searchParams]);

  const updateApplication = useUpdateApplication();
  const submitApplication = useSubmitApplication();

  const [stepData, setStepData] = React.useState<Record<string, unknown>>({});

  const handleStepDataChange = React.useCallback((data: Record<string, unknown>) => {
    if (data.productId && typeof data.productId === "string") {
      setSelectedProductId(data.productId);
    } else {
      setStepData(data);
    }
  }, []);

  const updateStep = React.useCallback((step: number) => {
    const params = new URLSearchParams();
    params.set("step", step.toString());
    router.push(`/applications/${applicationId}?${params.toString()}`);
  }, [router, applicationId]);

  const handleContinue = async () => {
    if (currentStep === 1 && !activeProductId) {
      toast.error("Please select a financing type");
      return;
    }

    try {
      if (currentStep === 1 && activeProductId) {
        const productHasChanged = activeProductId !== applicationProductId;
        
        const inputToSend: Record<string, unknown> = {
          productId: activeProductId,
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
      } else {
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
            id: applicationId,
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
      router.push(`/applications/${applicationId}?${params.toString()}`);
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
      router.replace(`/applications/${applicationId}`);
    } catch (error) {
      toast.error("Failed to submit application", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

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

  if (!activeProductId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No financing type selected</p>
          <Button onClick={() => router.push("/applications/new")}>Start New Application</Button>
        </div>
      </div>
    );
  }

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
                selectedProductId={activeProductId}
                onDataChange={handleStepDataChange}
              />
            ) : (
              <StepComponent
                stepId={currentStepId || "unknown"}
                stepName={currentStepName}
                stepConfig={{}}
                applicationId={applicationId}
                selectedProductId={activeProductId}
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
              disabled={currentStep === 1 && !activeProductId}
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
