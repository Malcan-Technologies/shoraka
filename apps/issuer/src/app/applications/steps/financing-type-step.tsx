"use client";

import * as React from "react";
import { useProducts } from "@/hooks/use-products";
import { ProductList } from "../components/product-list";
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
  const { data: productsData, isLoading: isLoadingProducts } = useProducts({
    page: 1,
    pageSize: 100,
  });

  const products = productsData?.products || [];

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

      //  Tell parent this step already has valid data
      if (onDataChange) {
        onDataChange({
          product_id: initialProductId,
          hasPendingChanges: false
        });
      }
    }
  }, [initialProductId, selectedProductId, onDataChange]);


  /**
   * When user selects a different product
   * 
   * Updates local state and notifies parent component.
   * Parent will save this when user clicks "Save and Continue".
   */
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);

    // Pass data to parent for saving
    if (onDataChange) {
      onDataChange({
        product_id: productId,
        hasPendingChanges: productId !== initialProductId
      });
    }
  };

  // Show loading state
  if (isLoadingProducts || debugSkeletonMode) {
    return (
      <>
        <FinancingTypeSkeleton />
        <DebugSkeletonToggle isSkeletonMode={debugSkeletonMode} onToggle={setDebugSkeletonMode} />
      </>
    );
  }

  // Show empty state
  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No financing products available
      </div>
    );
  }

  return (
    <>
    <div className="px-3">
      <ProductList
        products={products}
        selectedProductId={selectedProductId}
        onProductSelect={handleProductSelect}
          isLoading={isLoadingProducts}
      />
    </div>
    <DebugSkeletonToggle isSkeletonMode={debugSkeletonMode} onToggle={setDebugSkeletonMode} />
    </>
  );
}
