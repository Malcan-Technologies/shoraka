"use client";

import * as React from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useProduct } from "@/hooks/use-product";
import { ProgressIndicator } from "@/components/progress-indicator";
import { BellIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { useApplication, useUpdateApplication, useSubmitApplication } from "@/hooks/use-applications";
import { toast } from "sonner";
import { getStepComponent, getStepSkeleton } from "../new/step-components";
import type { Product } from "../new/types";
import { hasWorkflow, toWorkflowStepInfo } from "../new/helpers";

export default function ApplicationWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const applicationId = params.id as string;

  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const productId = application?.financingType?.productId || null;
  const { data: selectedProduct } = useProduct(productId);

  const workflowSteps = React.useMemo(() => {
    if (!selectedProduct || !hasWorkflow(selectedProduct)) {
      return [];
    }
    const product = selectedProduct as Product;
    return product.workflow.map((step) => toWorkflowStepInfo(step));
  }, [selectedProduct]);

  const currentStep = React.useMemo(() => {
    const stepParam = searchParams.get("step");
    const step = stepParam ? parseInt(stepParam, 10) : 1;
    return Math.max(1, Math.min(step, workflowSteps.length || 1));
  }, [searchParams, workflowSteps.length]);

  const currentStepInfo = workflowSteps[currentStep - 1];
  const currentStepId = currentStepInfo?.id || "";
  const currentStepName = currentStepInfo?.name || "Loading...";
  const currentStepConfig = currentStepInfo?.config || {};

  const StepComponent = getStepComponent(currentStepId);
  const updateApplication = useUpdateApplication();
  const submitApplication = useSubmitApplication();
  const [stepData, setStepData] = React.useState<Record<string, unknown>>({});

  const handleStepDataChange = React.useCallback((data: Record<string, unknown>) => {
    if (data.productId && typeof data.productId === "string") {
      toast.error("Cannot change financing type after application is created");
      return;
    }
    setStepData(data);
  }, []);

  const goToStep = React.useCallback((step: number) => {
    const params = new URLSearchParams();
    params.set("step", step.toString());
    router.push(`/applications/${applicationId}?${params.toString()}`);
  }, [router, applicationId]);

  const handleContinue = async () => {
    if (currentStep === 1 && !productId) {
      toast.error("Please select a financing type");
      return;
    }

    try {
      if (currentStep === 1 && productId) {
        await updateApplication.mutateAsync({
          id: applicationId,
          input: { productId },
        });
        toast.success("Financing type updated");
      } else {
        let dataToSave = { ...stepData };

        if (stepData._uploadFiles && typeof stepData._uploadFiles === "function") {
          try {
            const uploadResult = await (stepData._uploadFiles as () => Promise<{ supportingDocuments: unknown } | null>)();
            if (uploadResult) {
              dataToSave = { ...dataToSave, ...uploadResult };
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
            input: { data: dataToSave },
          });
          toast.success("Data saved successfully");
        }
      }
    } catch (error) {
      toast.error("Failed to save", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      return;
    }

    if (currentStep < workflowSteps.length) {
      goToStep(currentStep + 1);
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

  if (!productId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No financing type selected</p>
          <Button onClick={() => router.push("/applications/new")}>Start New Application</Button>
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
        <div className="flex flex-1 flex-col gap-4">
          <div className="max-w-7xl mx-auto w-full px-2 md:px-4 pt-8 space-y-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                {currentStep === 1
                  ? "Select financing type"
                  : currentStepId === "verify_company_info_1"
                  ? "Verify company details"
                  : currentStepName}
              </h1>
              <p className="text-[15px] leading-7 text-muted-foreground mt-1">
                {currentStep === 1
                  ? "Browse and invest in verified loan opportunities from your dashboard"
                  : currentStepId === "verify_company_info_1"
                  ? "Browse and invest in verified loan opportunities from your dashboard"
                  : "Temporary description for " + currentStepName}
              </p>
            </div>
          </div>

          <div className="border-b border-border -mx-4">
            <div className="max-w-7xl mx-auto w-full px-4 pt-2 pb-4">
              <ProgressIndicator
                steps={workflowSteps.map((s) => {
                  if (s.name === "Company Info" || s.id === "verify_company_info_1") {
                    return "Verify company info";
                  }
                  return s.name;
                })}
                currentStep={currentStep - 1}
                isLoading={isLoadingApp || !selectedProduct}
              />
            </div>
          </div>

          <div className="max-w-7xl mx-auto w-full px-2 md:px-4 pt-6 space-y-12">
            {currentStepInfo && selectedProduct && currentStepId ? (
              <StepComponent
                stepId={currentStepId}
                stepName={currentStepName}
                stepConfig={currentStepConfig}
                applicationId={applicationId}
                selectedProductId={productId}
                onDataChange={handleStepDataChange}
              />
            ) : currentStepId ? (
              <StepComponent
                stepId={currentStepId}
                stepName={currentStepName}
                stepConfig={{}}
                applicationId={applicationId}
                selectedProductId={productId}
                onDataChange={handleStepDataChange}
              />
            ) : currentStep === 1 ? (
              getStepSkeleton("financing_type_1")
            ) : workflowSteps.length > 0 && workflowSteps[currentStep - 1]?.id ? (
              getStepSkeleton(workflowSteps[currentStep - 1].id)
            ) : null}
          </div>
        </div>
      </main>

      <footer className="flex h-16 shrink-0 items-center justify-between gap-4 border-t px-4">
        <div>
          {currentStep > 1 && (
            <Button variant="outline" onClick={() => goToStep(currentStep - 1)}>
              Back
            </Button>
          )}
        </div>
        <div>
          {currentStep < workflowSteps.length ? (
            <Button
              onClick={handleContinue}
              disabled={currentStep === 1 && !productId}
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
