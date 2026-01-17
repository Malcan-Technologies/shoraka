import * as React from "react";
import { FinancingTypeCard } from "@/components/financing-type-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/hooks/use-products";
import type { StepComponentProps } from "../step-components";

/**
 * Financing Type Step Component
 * Step ID: "financing-type-1"
 * File name must match step ID: financing-type-1.tsx
 */
export default function FinancingTypeStep({
  selectedProductId,
  onDataChange,
}: StepComponentProps) {
  const [localSelectedProductId, setLocalSelectedProductId] = React.useState<string | null>(selectedProductId);

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
