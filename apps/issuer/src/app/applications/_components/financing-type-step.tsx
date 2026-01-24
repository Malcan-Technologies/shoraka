"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/hooks/use-products";

interface FinancingTypeStepProps {
  selectedProductId: string;
  onProductSelect: (productId: string) => void;
}

export function FinancingTypeStep({
  selectedProductId,
  onProductSelect,
}: FinancingTypeStepProps) {
  const { data: productsData, isLoading } = useProducts({
    page: 1,
    pageSize: 100,
  });

  const products = productsData?.products || [];

  // Group products by category
  const productsByCategory = React.useMemo(() => {
    const grouped: Record<string, any[]> = {};
    products.forEach((product: any) => {
      const workflow = product.workflow || [];
      
      const financingStep = workflow.find(
        (step: any) => step.name?.toLowerCase().includes("financing type")
      );
      const config = financingStep?.config || {};

      const category = config.category || "Other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push({
        id: product.id,
        name: config.name || "Unnamed Product",
        description: config.description || "",
        imageUrl: config.s3_key || "", 
      });
    });
    return grouped;
  }, [products]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-6 w-40 mb-2" />
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className="space-y-4 pl-4 md:pl-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="relative flex items-start gap-4 border rounded-xl p-4"
            >
              <Skeleton className="w-14 h-14 shrink-0 rounded-lg" />
              <div className="flex-1 pr-8 md:pr-10 space-y-2">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
              <div className="absolute top-4 right-4">
                <Skeleton className="h-5 w-5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (Object.keys(productsByCategory).length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        No products found
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
        <div key={category} className="space-y-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold">{category}</h2>
            <div className="mt-2 h-px bg-border" />
          </div>

          <div className="space-y-4 pl-4 md:pl-6">
            {categoryProducts.map((product) => {
              const isSelected = selectedProductId === product.id;
              return (
                <label
                  key={product.id}
                  className={`relative flex items-start gap-4 border rounded-xl p-4 cursor-pointer transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => onProductSelect(product.id)}
                >
                  <div className="w-14 h-14 shrink-0 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-muted-foreground text-[9px] text-center px-1 leading-tight">
                        Image
                        <br />
                        512x512
                      </div>
                    )}
                  </div>
                  <div className="flex-1 pr-8 md:pr-10">
                    <div className="font-semibold text-lg md:text-xl leading-7">
                      {product.name}
                    </div>
                    <div className="text-muted-foreground text-sm md:text-base leading-6">
                      {product.description}
                    </div>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onProductSelect(product.id);
                        }
                      }}
                      className="rounded"
                    />
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
