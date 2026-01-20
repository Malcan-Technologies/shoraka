"use client";

import * as React from "react";
import { FinancingTypeCard } from "@/components/financing-type-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/hooks/use-products";
import type { StepComponentProps } from "../step-components";
import type { Product, ProductsResponse } from "../types";
import { hasProducts, extractFinancingType } from "../helpers";

export default function FinancingTypeStep({
  selectedProductId,
  onDataChange,
}: StepComponentProps) {
  const [localSelectedProductId, setLocalSelectedProductId] = React.useState<string | null>(selectedProductId);

  const { data: productsData, isLoading: isLoadingProducts } = useProducts({
    page: 1,
    pageSize: 100,
  });

  const financingTypes = React.useMemo(() => {
    if (!productsData) {
      return [];
    }

    if (!hasProducts(productsData)) {
      return [];
    }

    const response = productsData as ProductsResponse;
    return response.products.map((product: Product) => {
      return extractFinancingType(product);
    });
  }, [productsData]);

  const groupedByCategory = React.useMemo(() => {
    const grouped: Record<string, typeof financingTypes> = {};
    
    financingTypes.forEach((type) => {
      const category = type.category || "Other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(type);
    });

    return grouped;
  }, [financingTypes]);

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
    <div className="space-y-12">
      {Object.entries(groupedByCategory).map(([category, types]) => (
        <div key={category}>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-semibold">{category}</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 mt-6">
            {types.map((type) => (
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
        </div>
      ))}
    </div>
  );
}
