"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-products";
import { useProduct } from "@/hooks/use-product";
import { FinancingTypeCard } from "@/components/financing-type-card";
import { ProgressIndicator } from "@/components/progress-indicator";
import { BellIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewApplicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  // Extract workflow steps from selected product
  const workflowSteps = React.useMemo(() => {
    if (!selectedProduct || !(selectedProduct as any).workflow || !Array.isArray((selectedProduct as any).workflow)) {
      return [];
    }
    // Extract step names from workflow
    return ((selectedProduct as any).workflow as any[]).map((step: any) => step.name || "Unknown Step");
  }, [selectedProduct]);

  const totalSteps = workflowSteps.length;

  // Get current step from URL, default to 1
  const currentStep = React.useMemo(() => {
    const stepParam = searchParams.get("step");
    const step = stepParam ? parseInt(stepParam, 10) : 1;
    return Math.max(1, Math.min(step, totalSteps || 1)); // Clamp between 1 and total steps
  }, [searchParams, totalSteps]);

  // Update URL with new step
  const updateStep = React.useCallback((step: number) => {
    const params = new URLSearchParams();
    params.set("step", step.toString());
    router.push(`/applications/new?${params.toString()}`);
  }, [router]);

  const handleContinue = () => {
    if (currentStep === 1 && !selectedProductId) {
      return; // Step 1 requires product selection
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
            <h2 className="text-2xl font-semibold">
              {workflowSteps[currentStep - 1] || "Loading..."}
            </h2>
            {currentStep === 1 && (
              <p className="text-muted-foreground">
                Browse and invest in verified loan opportunities from your dashboard
              </p>
            )}
          </div>

          {/* Progress Indicator */}
          {workflowSteps.length > 0 && (
            <ProgressIndicator steps={workflowSteps} currentStep={currentStep - 1} />
          )}

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
                      isSelected={selectedProductId === type.id}
                      onSelect={() => {
                        setSelectedProductId(type.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2+: Other steps (placeholder) */}
          {currentStep > 1 && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                {workflowSteps[currentStep - 1] || "Unknown"} step - Coming soon
              </p>
              {selectedProductId && (
                <p className="text-sm text-muted-foreground">Selected Product ID: {selectedProductId}</p>
              )}
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
