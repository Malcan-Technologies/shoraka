"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-products";
import { FinancingTypeCard } from "@/components/financing-type-card";
import { ProgressIndicator } from "@/components/progress-indicator";
import { BellIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function NewApplicationPage() {
  const router = useRouter();
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);

  // Fetch all products (financing types)
  const { data, isLoading } = useProducts({
    page: 1,
    pageSize: 100, // Get all products
  });

  // Transform products to financing types
  const financingTypes = React.useMemo(() => {
    if (!data || !(data as any).products) {
      return [];
    }

    return ((data as any).products as any[]).map((product: any) => {
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
  }, [data]);

  const handleContinue = () => {
    if (!selectedProductId) {
      return;
    }
    // Navigate to next step (financing terms) with selected product ID
    router.push(`/applications/new/financing-terms?productId=${selectedProductId}`);
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
            <h2 className="text-2xl font-semibold">Select financing type</h2>
            <p className="text-muted-foreground">
              Browse and invest in verified loan opportunities from your dashboard
            </p>
          </div>

          {/* Progress Indicator */}
          <ProgressIndicator steps={WORKFLOW_STEPS} currentStep={0} />

          {/* Financing Type Cards */}
          <div className="space-y-3">
            {isLoading ? (
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
                    onSelect={() => setSelectedProductId(type.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer with Continue Button */}
      <footer className="flex h-16 shrink-0 items-center justify-end gap-4 border-t px-4 sm:px-6">
        <Button
          onClick={handleContinue}
          disabled={!selectedProductId}
          className="gap-2"
        >
          Save and continue
          <ArrowRightIcon className="h-4 w-4" />
        </Button>
      </footer>
    </div>
  );
}
