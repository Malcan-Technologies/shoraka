"use client";

import * as React from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-products";
import { FinancingTypeCard } from "@/components/financing-type-card";
import { ProgressIndicator } from "@/components/progress-indicator";
import { BellIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApplication,
  useValidateStep,
  useUpdateApplication,
  useSubmitApplication,
} from "@/hooks/use-applications";
import { toast } from "sonner";

// Progress steps for the application workflow
const WORKFLOW_STEPS = [
  "Financing Type",
  "Financing Terms",
  "Invoice Details",
  "Verify Company Info",
  "Supporting Documents",
  "Declaration",
  "Review & Submit",
] as const;

const TOTAL_STEPS = WORKFLOW_STEPS.length;

export default function ApplicationWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const applicationId = params.id as string;

  // Get current step from URL, default to 1
  const currentStep = React.useMemo(() => {
    const stepParam = searchParams.get("step");
    const step = stepParam ? parseInt(stepParam, 10) : 1;
    return Math.max(1, Math.min(step, TOTAL_STEPS)); // Clamp between 1 and total steps
  }, [searchParams]);

  // Fetch application
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);

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

  // Fetch all products (financing types)
  const { data: productsData, isLoading: isLoadingProducts } = useProducts({
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

  // Extract productId from financingType
  const selectedProductId = application?.financingType?.productId || null;
  const [localSelectedProductId, setLocalSelectedProductId] = React.useState<string | null>(selectedProductId);

  // Sync local state with application data
  React.useEffect(() => {
    if (application?.financingType?.productId) {
      setLocalSelectedProductId(application.financingType.productId);
    }
  }, [application?.financingType?.productId]);

  const updateApplication = useUpdateApplication();
  const submitApplication = useSubmitApplication();

  // Update URL with new step
  const updateStep = React.useCallback((step: number) => {
    router.push(`/applications/${applicationId}?step=${step}`);
  }, [router, applicationId]);

  const handleContinue = async () => {
    if (currentStep === 1 && !localSelectedProductId) {
      toast.error("Please select a financing type");
      return;
    }

    // Save step 1 data (productId)
    if (currentStep === 1 && localSelectedProductId) {
      try {
        await updateApplication.mutateAsync({
          id: applicationId,
          input: {
            productId: localSelectedProductId,
          },
        });
      } catch (error) {
        toast.error("Failed to save", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        return;
      }
    }

    // Move to next step
    if (currentStep < TOTAL_STEPS) {
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

  // If application not found or not in DRAFT status, show error
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
            <h2 className="text-2xl font-semibold">{WORKFLOW_STEPS[currentStep - 1]}</h2>
            {currentStep === 1 && (
              <p className="text-muted-foreground">
                Browse and invest in verified loan opportunities from your dashboard
              </p>
            )}
          </div>

          {/* Progress Indicator */}
          <ProgressIndicator steps={WORKFLOW_STEPS} currentStep={currentStep - 1} />

          {/* Step Content */}
          {currentStep === 1 && (
            <div className="space-y-3">
              {isLoadingProducts ? (
                // Loading skeleton
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                  ))}
                </div>
              ) : financingTypes.length === 0 ? (
                // Empty state
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No financing types available</p>
                </div>
              ) : (
                // Financing type rows
                <div className="space-y-3">
                  {financingTypes.map((type) => (
                    <FinancingTypeCard
                      key={type.id}
                      id={type.id}
                      name={type.name}
                      description={type.description}
                      s3Key={type.s3Key}
                      isSelected={localSelectedProductId === type.id}
                      onSelect={() => {
                        setLocalSelectedProductId(type.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Financing Terms (placeholder) */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-muted-foreground">Financing Terms step - Coming soon</p>
              <p className="text-sm text-muted-foreground">Selected Product ID: {selectedProductId}</p>
            </div>
          )}

          {/* Step 3+: Other steps (placeholder) */}
          {currentStep > 2 && (
            <div className="space-y-4">
              <p className="text-muted-foreground">{WORKFLOW_STEPS[currentStep - 1]} step - Coming soon</p>
            </div>
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
          {currentStep < TOTAL_STEPS ? (
            <Button
              onClick={handleContinue}
              disabled={currentStep === 1 && !localSelectedProductId}
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
