"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@cashsouk/ui";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { useProducts } from "@/hooks/use-products";
import { useCreateApplication } from "@/hooks/use-applications";
import { useOrganization } from "@cashsouk/config";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductList } from "../components/product-list";
import { ProgressIndicator } from "../components/progress-indicator";

/**
 * NEW APPLICATION PAGE
 * 
 * This is where users start a new loan application.
 * It's Step 1: User selects which financing product they want.
 * 
 * Flow:
 * 1. Load all available products from API
 * 2. User selects one product
 * 3. Click "Continue" creates application in DB
 * 4. Redirect to /applications/edit/{id}?step=2
 */
export default function NewApplicationPage() {
  const router = useRouter();
  const { activeOrganization } = useOrganization();

  // Load products from API
  const {
    data: productsData,
    isLoading: isLoadingProducts,
    refetch: refetchProducts,
  } = useProducts({
    page: 1,
    pageSize: 100,
  });


  // Hook to create application
  const createApplicationMutation = useCreateApplication();

  // Track which product user selected
  const [selectedProductId, setSelectedProductId] = React.useState<string>("");

  /**
   * ORGANIZATION VERIFICATION CHECK
   * 
   * Only allow access if organization is verified (onboardingStatus === "COMPLETED").
   * If not verified, redirect to dashboard with error message.
   */
  React.useEffect(() => {
    if (!activeOrganization) {
      // No organization selected - redirect to dashboard
      router.push("/");
      return;
    }

    if (activeOrganization.onboardingStatus !== "COMPLETED") {
      // Organization not verified - redirect to dashboard
      toast.error("Your organization must be verified before creating applications");
      router.push("/");
      return;
    }
  }, [activeOrganization, router]);

  const products = productsData?.products || [];

  /**
    * AUTO-SELECT FIRST PRODUCT
    * 
    * When products load, automatically select the first one.
    * This gives users a default choice and shows the workflow immediately.
    */
  React.useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  /**
   * GET WORKFLOW STEPS
   * 
   * Get the list of steps from the selected product.
   * This shows users what the complete journey will look like.
   * 
   * Example: ["Financing Type", "Verify Company Info", "Documents", "Declarations"]
   */
  const workflowSteps = React.useMemo(() => {
    if (!selectedProductId || products.length === 0) {
      return [];
    }

    const selectedProduct = products.find((p: any) => p.id === selectedProductId);

    if (!selectedProduct || !selectedProduct.workflow) {
      return [];
    }

    return selectedProduct.workflow.map((step: any) => step.name);
  }, [selectedProductId, products]);


  // Don't render page content if organization is not verified
  if (!activeOrganization || activeOrganization.onboardingStatus !== "COMPLETED") {
    return (
      <div className="flex flex-col h-full">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Skeleton className="h-6 w-32" />
        </header>
        <main className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Verifying organization access...</p>
          </div>
        </main>
      </div>
    );
  }


  /**
   * When user selects a product
   */
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
  };

  /**
   * When user clicks "Continue"
   * 
   * Creates application in DB with:
   * - productId
   * - organizationId
   * 
   * Backend creates record with status=DRAFT and last_completed_step=1
   */
  const handleContinue = async () => {
    // ===============================
    // VERSION CHECK BEFORE CREATE
    // ===============================
    const { data: latestProductsData } = await refetchProducts();

    const latestProducts = latestProductsData?.products || [];

    const latestProduct = latestProducts.find(
      (p: any) => p.id === selectedProductId
    );

    if (!latestProduct) {
      toast.error("Selected product is no longer available.");
      return;
    }

    // Compare against what the user is currently seeing on this page
    const currentProduct = productsData?.products?.find(
      (p: any) => p.id === selectedProductId
    );

    if (!currentProduct) {
      toast.error("Unable to validate product version.");
      return;
    }

    if (latestProduct.version !== currentProduct.version) {
      toast.error(
        "This financing product was updated. Please review it again before continuing."
      );
      return;
    }



    // Validate we have what we need
    if (!selectedProductId) {
      toast.error("Please select a financing type");
      return;
    }

    if (!activeOrganization) {
      toast.error("Please select an organization first");
      return;
    }

    try {
      // Call API: POST /v1/applications
      const application = await createApplicationMutation.mutateAsync({
        productId: selectedProductId,
        issuerOrganizationId: activeOrganization.id,
      });

      toast.success("Application created successfully");

      // Go to step 2 (next step after selecting product)
      router.push(`/applications/edit/${application.id}?step=2`);
    } catch (error) {
      // Error already shown by mutation hook
    }
  };

  // Show loading state while fetching products
  if (isLoadingProducts) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Skeleton className="h-6 w-32" />
        </header>

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto w-full px-4 py-8">
            <Skeleton className="h-9 w-64 mb-2" />
            <Skeleton className="h-5 w-96 mb-8" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>

        <footer className="sticky bottom-0 border-t bg-background">
          <div className="max-w-7xl mx-auto w-full px-4 py-4 flex justify-end">
            <Skeleton className="h-12 w-40 rounded-xl" />
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top navigation bar */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">New Application</h1>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-7xl mx-auto w-full px-4 py-8">
          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Select financing type
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground mt-1">
              Browse and invest in verified loan opportunities from your dashboard
            </p>
          </div>

          {/* Progress Indicator */}
          {workflowSteps.length > 0 && (
            <ProgressIndicator
              steps={workflowSteps}
              currentStep={1}
              isLoading={false}
            />
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border w-full" />

        {/* Product List */}
        <div className="max-w-7xl mx-auto w-full px-4 pt-6">
          {products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No financing products available
            </div>
          ) : (
            <ProductList
              products={products}
              selectedProductId={selectedProductId}
              onProductSelect={handleProductSelect}
            />
          )}
        </div>
      </main>

      {/* Bottom button */}
      <footer className="sticky bottom-0 border-t bg-background">
        <div className="max-w-7xl mx-auto w-full px-4 py-4 flex justify-end">
          <Button
            onClick={handleContinue}
            disabled={!selectedProductId || createApplicationMutation.isPending}
            className="bg-primary text-primary-foreground hover:opacity-95 shadow-brand text-[17px] font-semibold px-6 py-3 rounded-xl h-11"
          >
            {createApplicationMutation.isPending ? "Creating..." : "Continue"}
            <ArrowRightIcon className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
