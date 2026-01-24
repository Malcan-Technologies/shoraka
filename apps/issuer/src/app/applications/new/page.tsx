"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ProgressIndicator } from "@/components/progress-indicator";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { useProducts } from "@/hooks/use-products";
import { useCreateApplication } from "@/hooks/use-applications";
import { useOrganization } from "@cashsouk/config";
import { toast } from "sonner";
import { FinancingTypeStep } from "../_components/financing-type-step";

export default function NewApplicationPage() {
  const router = useRouter();
  const { activeOrganization } = useOrganization();
  const { data: productsData, isLoading: isLoadingProducts } = useProducts({
    page: 1,
    pageSize: 100,
  });
  const createApplicationMutation = useCreateApplication();

  const [selectedProductId, setSelectedProductId] = React.useState<string>("");

  const products = productsData?.products || [];

  // Set default selected product once products are loaded
  React.useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
  };

  const handleContinue = async () => {
    if (!selectedProductId || !activeOrganization) {
      toast.error("Please select a product and ensure you are in an organization");
      return;
    }

    try {
      const application = await createApplicationMutation.mutateAsync({
        productId: selectedProductId,
        issuerOrganizationId: activeOrganization.id,
      });

      toast.success("Application created successfully");
      router.push(`/applications/edit/${application.id}?step=2`);
    } catch (error) {
      // Error is handled by mutation
    }
  };

  const workflowSteps = React.useMemo(() => {
    const selectedProduct = products.find((p: any) => p.id === selectedProductId);
    if (!selectedProduct || !selectedProduct.workflow) {
      return ["Financing Type"];
    }
    return selectedProduct.workflow.map((step: any) => step.name);
  }, [products, selectedProductId]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pt-0">
        <div className="flex flex-1 flex-col gap-4">
          <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8">
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Select financing type
              </h1>
              <p className="text-[15px] leading-7 text-muted-foreground mt-1">
                Browse and invest in verified loan opportunities from your dashboard
              </p>
            </div>

            <ProgressIndicator
              steps={workflowSteps}
              currentStep={1}
              isLoading={isLoadingProducts}
            />
          </div>

          <div className="h-px bg-border w-full -mx-4" />

          <div className="max-w-7xl mx-auto w-full px-2 md:px-4 pt-6">
            <FinancingTypeStep 
              selectedProductId={selectedProductId}
              onProductSelect={handleProductSelect}
            />
          </div>
        </div>
      </main>

      <footer className="sticky bottom-0 border-t bg-background z-10 mt-auto">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-4 flex justify-end">
          <Button
            onClick={handleContinue}
            disabled={!selectedProductId || createApplicationMutation.isPending}
            className="bg-primary text-primary-foreground hover:opacity-95 shadow-brand text-base md:text-[17px] font-semibold px-4 md:px-6 py-2.5 md:py-3 rounded-xl w-full md:w-auto"
          >
            {createApplicationMutation.isPending ? "Creating..." : "Save and continue"}
            <ArrowRightIcon className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
