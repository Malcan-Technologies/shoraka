import * as React from "react";
import { FinancingTypeCard } from "@/components/financing-type-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/hooks/use-products";
import type { StepComponentProps } from "../step-components";
import type { Product, FinancingType, ProductsResponse } from "../types";
import { hasProducts, extractFinancingType } from "../helpers";

/**
 * Financing Type Step Component
 * 
 * This component shows a list of financing types (products) for the user to choose from.
 * 
 * Step ID: "financing-type-1"
 * File name must match step ID: financing-type-1.tsx
 */
export default function FinancingTypeStep({
  selectedProductId,
  onDataChange,
}: StepComponentProps) {
  // Keep track of which product the user selected
  const [localSelectedProductId, setLocalSelectedProductId] = React.useState<string | null>(selectedProductId);

  // Step 1: Fetch all products from the API
  const { data: productsData, isLoading: isLoadingProducts } = useProducts({
    page: 1,
    pageSize: 100,
  });

  // Step 2: Transform products into financing types for display
  const financingTypes = React.useMemo((): FinancingType[] => {
    // If we don't have data yet, return empty array
    if (!productsData) {
      return [];
    }

    // Check if the response has products
    if (!hasProducts(productsData)) {
      return [];
    }

    // Convert each product to a financing type
    const response = productsData as ProductsResponse;
    return response.products.map((product: Product) => {
      return extractFinancingType(product);
    });
  }, [productsData]);

  // Sync with parent when selection changes
  React.useEffect(() => {
    if (localSelectedProductId && onDataChange) {
      onDataChange({ productId: localSelectedProductId });
    }
  }, [localSelectedProductId, onDataChange]);

  if (isLoadingProducts) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (financingTypes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No financing types available</p>
      </div>
    );
  }

  return (
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
  );
}
