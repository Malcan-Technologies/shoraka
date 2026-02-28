"use client";

import * as React from "react";
import { useProducts, useProduct } from "@/hooks/use-products";
import { ProductList } from "../components/product-list";
import { SelectionCard } from "../components/selection-card";
import { FinancingTypeSkeleton } from "@/app/applications/components/financing-type-skeleton";
import { DebugSkeletonToggle } from "@/app/applications/components/debug-skeleton-toggle";

/**
 * FINANCING TYPE STEP
 * 
 * This step component shows product selection in the edit flow.
 * 
 * Different from /new page:
 * - Loads selected product from database
 * - User can change their selection
 * - Passes selected product ID to parent for saving
 * 
 * Props:
 * - initialProductId: product saved in DB (from application.financing_type.product_id)
 * - onDataChange: callback to pass selected product ID to parent
 */
interface FinancingTypeStepProps {
  initialProductId?: string;
  onDataChange?: (data: any) => void;
}

export function FinancingTypeStep({
  initialProductId,
  onDataChange,
}: FinancingTypeStepProps) {
  // DEBUG: Toggle skeleton mode
  const [debugSkeletonMode, setDebugSkeletonMode] = React.useState(false);
  
  // Load all products
  // If initialProductId is present (edit flow), fetch only that product.
  const { data: productsData, isLoading: isLoadingProducts } = initialProductId
    ? { data: undefined, isLoading: false }
    : useProducts({
        page: 1,
        pageSize: 100,
        activeOnly: true,
      } as any);

  const singleProductQuery = useProduct(initialProductId || "");
  const products = initialProductId ? (singleProductQuery?.data ? { products: [singleProductQuery.data] } : { products: [] }) : productsData || { products: [] };

  const isLoading = initialProductId ? singleProductQuery?.isLoading : isLoadingProducts;

  // Track which product is selected
  const [selectedProductId, setSelectedProductId] = React.useState<string>("");

  /**
   * Initialize with product from database
   * 
   * When page loads, set the product that's already saved.
   * User selected this in /new page, it's now in the database.
   */
  React.useEffect(() => {
    if (initialProductId && !selectedProductId) {
      setSelectedProductId(initialProductId);

      // Tell parent this step already has valid data
      if (onDataChange) {
        const savedProduct = products.products?.find((p: any) => p.id === initialProductId) ?? singleProductQuery?.data;
        onDataChange({
          product_id: initialProductId,
          product_version: savedProduct?.version,
          hasPendingChanges: false,
        });
      }
    }
  }, [initialProductId, selectedProductId, onDataChange]);


  /**
   * When user selects a different product
   * 
   * Updates local state and notifies parent component.
   * Parent will save this when user clicks "Save and Continue".
   * 
   * Also include the current product version so the parent can snapshot it
   * atomically when saving (server-side atomicity is ensured by service).
   */
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);

    // Find the selected product to include its version
    const selectedProduct = (products.products || []).find((p: any) => p.id === productId) ?? singleProductQuery?.data;

    // Pass data to parent for saving
    if (onDataChange) {
      onDataChange({
        product_id: productId,
        product_version: selectedProduct?.version,
        hasPendingChanges: productId !== initialProductId
      });
    }
  };

  // Show loading state
  if (isLoading || debugSkeletonMode) {
    return (
      <>
        <FinancingTypeSkeleton />
        <DebugSkeletonToggle isSkeletonMode={debugSkeletonMode} onToggle={setDebugSkeletonMode} />
      </>
    );
  }
  // Show empty state
  const productList = products.products || [];
  if (productList.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No financing products available
      </div>
    );
  }

  return (
    <>
    <div className="px-3">
      {initialProductId ? (
        // Edit mode: show only the selected product (read-only)
        productList.map((p: any) => (
          <div key={p.id} className="pointer-events-none">
            <SelectionCard
              title={p.workflow?.[0]?.config?.name || "Unnamed Product"}
              description={p.workflow?.[0]?.config?.description || ""}
              isSelected={true}
              onClick={() => {}}
              leading={
                <div className="h-14 w-14 rounded-md border border-border bg-white flex items-center justify-center overflow-hidden">
                  {/* Image */}
                  <img
                    src={p.workflow?.[0]?.config?.image?.s3_key || ""}
                    alt={p.workflow?.[0]?.config?.name || ""}
                    className="w-full h-full object-contain"
                  />
                </div>
              }
            />
          </div>
        ))
      ) : (
        <ProductList
          products={products.products}
          selectedProductId={selectedProductId}
          onProductSelect={handleProductSelect}
          isLoading={isLoadingProducts}
        />
      )}
    </div>
    <DebugSkeletonToggle isSkeletonMode={debugSkeletonMode} onToggle={setDebugSkeletonMode} />
    </>
  );
}
