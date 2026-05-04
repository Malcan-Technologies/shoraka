"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useHeader, SidebarTrigger } from "@cashsouk/ui";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { useIssuerProducts } from "@/hooks/use-products";
import { useCreateApplication } from "@/hooks/use-applications";
import { filterVisiblePeopleRows } from "@cashsouk/types";
import type { Product } from "@cashsouk/types";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import { toast } from "sonner";
import { useNavigationGuard } from "@/hooks/use-navigation-guard2";
import { useIssuerUnsavedNavigation } from "@/contexts/issuer-unsaved-navigation-context";
import { UnsavedChangesModal } from "@/components/unsaved-changes-modal";
import { VersionMismatchModal } from "@/components/VersionMismatchModal";
import { Skeleton } from "@/components/ui/skeleton";
import { DirectorShareholderAlertCard } from "@/components/director-shareholder-alert-card";
import { ProductList } from "../components/product-list";
import { ProgressIndicator } from "../components/progress-indicator";
import { FinancingTypeSkeleton } from "../components/financing-type-skeleton";
import {
  MOCK_FINANCING_TYPE_PRODUCTS,
  USE_MOCK_FINANCING_TYPE_CATALOG,
} from "../lib/mock-financing-type-catalog";

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
  const { activeOrganization, isLoading: isOrgLoading } = useOrganization();

  const visiblePeopleForDsAlert = React.useMemo(
    () => filterVisiblePeopleRows(activeOrganization?.people ?? []),
    [activeOrganization?.people]
  );
  const { setTitle } = useHeader();

  React.useEffect(() => {
    setTitle("New Application");
  }, [setTitle]);

  // Load products from API
  const {
    data: productsData,
    isLoading: isLoadingProducts,
    refetch: refetchProducts,
  } = useIssuerProducts(
    {
      page: 1,
      pageSize: 100,
    },
    { staleTime: 0, refetchOnMount: true }
  );


  // Hook to create application
  const createApplicationMutation = useCreateApplication();

  // Track which product user selected
  const [selectedProductId, setSelectedProductId] = React.useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const pendingNavRef = React.useRef<{ path: string; leavingPage: boolean } | null>(null);
  const [versionModalOpen, setVersionModalOpen] = React.useState(false);
  const [versionModalReason, setVersionModalReason] = React.useState<
    "PRODUCT_UNAVAILABLE" | "PRODUCT_VERSION_CHANGED" | null
  >(null);

  const onConfirmNavigation = React.useCallback(
    (path: string) => {
      setHasUnsavedChanges(false);
      if (path === "__BACK__" || path === "/") {
        router.replace("/");
        return;
      }
      const pending = pendingNavRef.current;
      pendingNavRef.current = null;
      if (pending?.leavingPage) router.replace(path);
      else router.push(path);
    },
    [router]
  );

  const { isModalOpen, requestNavigation, confirmLeave, cancelLeave } = useNavigationGuard(
    hasUnsavedChanges,
    onConfirmNavigation
  );

  const { setGuard: setIssuerUnsavedNavGuard } = useIssuerUnsavedNavigation();

  const tryNavigateInternalLinks = React.useCallback(
    (href: string) => {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return true;
      const path = url.pathname + url.search + url.hash;
      const current = window.location.pathname + window.location.search + window.location.hash;
      if (path === current) return true;
      pendingNavRef.current = { path, leavingPage: true };
      requestNavigation(path);
      return false;
    },
    [requestNavigation]
  );

  React.useEffect(() => {
    if (!activeOrganization || activeOrganization.onboardingStatus !== "COMPLETED") {
      setIssuerUnsavedNavGuard(null);
      return;
    }
    setIssuerUnsavedNavGuard({
      hasUnsavedChanges,
      tryNavigate: tryNavigateInternalLinks,
    });
    return () => setIssuerUnsavedNavGuard(null);
  }, [
    activeOrganization,
    hasUnsavedChanges,
    tryNavigateInternalLinks,
    setIssuerUnsavedNavGuard,
  ]);

  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);

  /**
   * ORGANIZATION VERIFICATION CHECK
   *
   * Only allow access if organization is verified (onboardingStatus === "COMPLETED").
   * Wait for org list to load — otherwise refresh on /new briefly has no activeOrganization and would redirect incorrectly.
   */
  React.useEffect(() => {
    if (isOrgLoading) return;

    if (!activeOrganization) {
      router.push("/");
      return;
    }

    if (activeOrganization.onboardingStatus !== "COMPLETED") {
      toast.error("Your organization must be verified before creating applications");
      router.push("/");
    }
  }, [activeOrganization, isOrgLoading, router]);

  const apiProducts: Product[] = productsData?.products ?? [];
  const products = USE_MOCK_FINANCING_TYPE_CATALOG ? MOCK_FINANCING_TYPE_PRODUCTS : apiProducts;

  /**
   * Keep selection in sync with catalog (e.g. after “Refresh products” when empty or ids change).
   */
  React.useEffect(() => {
    if (products.length === 0) {
      if (selectedProductId) {
        console.log("New application: clearing product selection — no products in catalog");
        setSelectedProductId("");
      }
      return;
    }
    const stillThere = products.some((p: { id: string }) => p.id === selectedProductId);
    if (!stillThere) {
      console.log("New application: selection missing from catalog, defaulting to first product");
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

    const selectedProduct = products.find((p: Product) => p.id === selectedProductId);

    if (!selectedProduct || !selectedProduct.workflow) {
      return [];
    }

    return selectedProduct.workflow.map((step) => String((step as { name?: string }).name ?? ""));
  }, [selectedProductId, products]);


  // Don't render main content until org is resolved and verified (includes initial load after refresh)
  if (isOrgLoading || !activeOrganization || activeOrganization.onboardingStatus !== "COMPLETED") {
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
    setHasUnsavedChanges(true);
  };

  /**
   * When user clicks "Save and Continue"
   *
   * Creates application in DB with:
   * - productId
   * - organizationId
   *
   * Backend creates record with status=DRAFT and last_completed_step=1
   */
  const handleContinue = async () => {
    if (USE_MOCK_FINANCING_TYPE_CATALOG) {
      toast.info(
        "Mock catalog is on. Set USE_MOCK_FINANCING_TYPE_CATALOG to false in mock-financing-type-catalog.ts to create a real application."
      );
      return;
    }
    if (products.length === 0) {
      toast.error("No financing products available");
      return;
    }
    if (!selectedProductId || !products.some((p: { id: string }) => p.id === selectedProductId)) {
      toast.error("Please select a financing type");
      return;
    }

    if (!activeOrganization) {
      toast.error("Please select an organization first");
      return;
    }

    try {
      const liveResp = await apiClient.getIssuerProductLiveCheck(selectedProductId);
      const currentProduct = productsData?.products?.find((p: Product) => p.id === selectedProductId);

      if (!liveResp.success) {
        setVersionModalReason("PRODUCT_UNAVAILABLE");
        setVersionModalOpen(true);
        return;
      }

      const live = liveResp.data;

      if (live.outcome === "PRODUCT_UNAVAILABLE") {
        setVersionModalReason("PRODUCT_UNAVAILABLE");
        setVersionModalOpen(true);
        return;
      }

      const resolvedId = live.resolved_product_id!;
      const compareVersion = live.compare_version!;

      if (
        !currentProduct ||
        resolvedId !== selectedProductId ||
        compareVersion !== currentProduct.version
      ) {
        setVersionModalReason("PRODUCT_VERSION_CHANGED");
        setVersionModalOpen(true);
        return;
      }

      const application = await createApplicationMutation.mutateAsync({
        productId: resolvedId,
        issuerOrganizationId: activeOrganization.id,
      });

      toast.success("Application created successfully");

      // Clear unsaved and go to step 2 (next step after selecting product)
      setHasUnsavedChanges(false);
      router.push(`/applications/edit/${application.id}?step=2`);
    } catch {
      // Error already shown by mutation hook
    }
  };

  // Show loading state while fetching products (skip when using dev mock catalog)
  if (!USE_MOCK_FINANCING_TYPE_CATALOG && isLoadingProducts) {
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
          </div>

          {/* Divider */}
          <div className="h-px bg-border w-full" />

          {/* Product List Skeleton */}
          <div className="max-w-7xl mx-auto w-full px-4 pt-6">
            <FinancingTypeSkeleton />
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

  // (unsaved modal will be rendered inside returned JSX)
 
  return (
    <div className="flex flex-col h-full">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4">
        {activeOrganization.type === "COMPANY" ? (
          <DirectorShareholderAlertCard
            visiblePeople={visiblePeopleForDsAlert}
            issuerOrganizationId={activeOrganization.id}
            enabled={activeOrganization.onboardingStatus === "COMPLETED"}
            stickyTop
            className="mb-4"
            onGoToProfile={(matchKey) => {
              const personQuery = matchKey ? `&person=${encodeURIComponent(matchKey)}` : "";
              requestNavigation(`/profile?focus=directors${personQuery}`);
            }}
          />
        ) : null}
        <div className="max-w-7xl mx-auto w-full px-4 py-8">
          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Select financing type
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground mt-1">
              Browse and invest in verified financing opportunities from your dashboard
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
          {USE_MOCK_FINANCING_TYPE_CATALOG ? (
            <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              <p className="font-semibold">Development: mock product catalog</p>
              <p className="mt-1 text-[15px] leading-7 opacity-95">
                Sorting matches the live app: categories use{" "}
                <span className="font-mono text-xs">category_display_order</span> (lower first; missing → last), then
                name. Products inside a category use{" "}
                <span className="font-mono text-xs">product_display_order</span> (lower first; missing → last), then{" "}
                <span className="font-mono text-xs">created_at</span>. New products from admin get the next order values
                from the API when created. Save and Continue is disabled until you turn the mock off.
              </p>
            </div>
          ) : null}
          {products.length === 0 ? (
            <div className="text-center py-12 px-4 max-w-lg mx-auto space-y-2 text-muted-foreground">
              <p className="font-medium text-foreground">No financing products available</p>
              <p className="text-[15px] leading-7">
                Active products are created and published by platform administrators. Please contact
                your admin if you expected to see options here.
              </p>
            </div>
          ) : (
            <ProductList
              products={products}
              selectedProductId={selectedProductId}
              onProductSelect={handleProductSelect}
              isLoading={USE_MOCK_FINANCING_TYPE_CATALOG ? false : isLoadingProducts}
              showExtendedControls={USE_MOCK_FINANCING_TYPE_CATALOG}
            />
          )}
        </div>
      </main>

      {/* Bottom buttons - Back + Save and Continue */}
      <footer className="sticky bottom-0 border-t bg-background">
        <div className="max-w-7xl mx-auto w-full px-4 py-4 flex justify-between">
          <Button
            variant="outline"
            onClick={() => requestNavigation("/", { forceModal: true })}
            disabled={createApplicationMutation.isPending}
            className="text-sm sm:text-base font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl order-2 sm:order-1 h-11"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleContinue}
            disabled={
              USE_MOCK_FINANCING_TYPE_CATALOG ||
              products.length === 0 ||
              !selectedProductId ||
              !products.some((p: { id: string }) => p.id === selectedProductId) ||
              createApplicationMutation.isPending
            }
            className="bg-primary text-primary-foreground hover:opacity-95 shadow-brand text-sm sm:text-base font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl order-1 sm:order-2 h-11"
          >
            {createApplicationMutation.isPending ? "Creating..." : "Save and Continue"}
            <ArrowRightIcon className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </footer>

      {isModalOpen && (
        <UnsavedChangesModal
          variant="exit"
          hasUnsavedChanges={hasUnsavedChanges}
          onConfirm={() => confirmLeave()}
          onCancel={() => cancelLeave()}
        />
      )}

      <VersionMismatchModal
        open={versionModalOpen}
        blockReason={versionModalReason}
        onOpenChange={(open: boolean) => setVersionModalOpen(open)}
        primaryLabel="Refresh products"
        onPrimary={async () => {
          await refetchProducts();
          setVersionModalOpen(false);
        }}
      />
    </div>
  );
}
