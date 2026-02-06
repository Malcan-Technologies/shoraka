"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useS3ViewUrl } from "@/hooks/use-s3";



function ProductCardSkeleton() {
  return (
    <div className="block w-full">
      {/* Reserve 2px border space (same as real card) */}
      <div className="rounded-xl border-2 border-transparent">
        {/* Visible card */}
        <div className="w-full rounded-[10px] border border-border px-6 py-[10px]">
          <div className="flex items-start gap-4">
            {/* Image (56x56) */}
            <div className="shrink-0">
              <div className="h-[56px] w-[56px] rounded-sm border border-border bg-white overflow-hidden">
                <Skeleton className="h-full w-full" />
              </div>
            </div>

            {/* Text (TOP aligned like real card) */}
            <div className="min-w-0 flex-1 pt-[2px]">
              {/* Title line ≈ 20px text */}
              <Skeleton className="h-[20px] w-[62%] rounded" />

              {/* Description line ≈ 16px text — nudged DOWN a bit */}
              <Skeleton className="mt-[9px] h-[16px] w-[78%] rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

}

function CategorySkeleton() {
  return (
    <section className="space-y-4">
      <div>
        {/* Category header — VERY SLIGHTLY higher */}
        <Skeleton className="mt-[4px] h-[24px] w-[160px] rounded" />
        <div className="mt-2 h-px bg-border" />
      </div>

      <div className="space-y-3 pl-3 sm:pl-3 pr-3 sm:pr-3">
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </div>
    </section>
  );
}





/**
 * PRODUCT IMAGE
 * 
 * Shows product image from S3.
 * If image is loading or missing, shows placeholder.
 */
function ProductImage({ s3Key, alt }: { s3Key: string; alt: string }) {
  const { data: imageUrl, isLoading } = useS3ViewUrl(s3Key);

  if (isLoading) {
    return <Skeleton className="w-full h-full rounded-sm" />;
  }

  if (!imageUrl) {
    return (
      <div className="text-muted-foreground text-[9px] text-center px-1 leading-tight">
        Image
        <br />
        512x512
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className="w-full h-full object-contain"
    />
  );
}



/**
 * PRODUCT CARD
 * 
 * Shows one product with:
 * - Image
 * - Name
 * - Description
 * - Checkbox (selected state)
 * 
 * When clicked, calls onSelect with the product ID
 */
interface ProductCardProps {
  id: string;
  name: string;
  description: string;
  imageS3Key: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function ProductCard({ id, name, description, imageS3Key, isSelected, onSelect }: ProductCardProps) {
  return (
    <label
      onClick={() => onSelect(id)}
      className="block w-full cursor-pointer"
    >
      {/* 
        Outer wrapper ALWAYS reserves 2px border space 
        so switching 1px → 2px never shifts layout
      */}
      <div className="rounded-xl border-2 border-transparent">
        {/* Actual visible card */}
        <div
          className={[
            "w-full rounded-[10px] transition-colors",
            "px-6 py-[10px]", // tighter card
            isSelected
              ? "border-2 border-primary"
              : "border border-border hover:border-primary/50",
          ].join(" ")}
        >
          <div className="flex items-start gap-4">
            {/* Image */}
            <div className="shrink-0">
              <div
                className="h-[56px] w-[56px] rounded-sm border border-border bg-white flex items-center justify-center overflow-hidden"
                style={{
                  boxShadow: "0 1px 1px hsl(var(--border))",
                }}
              >
                <ProductImage s3Key={imageS3Key} alt={name} />
              </div>
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <div className="text-[20px] leading-[28px] font-medium text-foreground line-clamp-1">
                {name}
              </div>
              <div className=" text-[16px] leading-[22px] text-muted-foreground line-clamp-1">
                {description}
              </div>
            </div>
          </div>
        </div>
      </div>
    </label>
  )

}





/**
 * PRODUCT LIST
 * 
 * Shows all available products grouped by category.
 * User can select one product.
 * 
 * Props:
 * - products: array of products from API (any structure)
 * - selectedProductId: which product is currently selected
 * - onProductSelect: function to call when user selects a product
 */
interface ProductListProps {
  products: any[];  // Accept any product structure from API
  selectedProductId: string;
  onProductSelect: (productId: string) => void;
  isLoading: boolean;
}

export function ProductList({ products, selectedProductId, onProductSelect, isLoading }: ProductListProps) {
  /**
   * Group products by category
   * 
   * Extracts product info from the workflow config.
   * Each product has a workflow, and the first step (Financing Type) 
   * contains the display information in its config.
   */
  const productsByCategory = React.useMemo(() => {
    const grouped: Record<string, any[]> = {};

    products.forEach((product: any) => {
      // Find the "Financing Type" step in the workflow
      const financingStep = product.workflow?.find((step: any) =>
        step.name?.toLowerCase().includes("financing type")
      );
      const config = financingStep?.config || {};

      // Extract data from config (image can be nested config.image or legacy config.s3_key)
      const category = config.category || "Other";
      const name = config.name || "Unnamed Product";
      const description = config.description || "";
      const imageUrl = config.image?.s3_key || config.s3_key || "";

      // Create product data
      const productData = {
        id: product.id,
        name: name,
        description: description,
        imageUrl: imageUrl,
        category: category,
      };

      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(productData);
    });

    return grouped;
  }, [products]);

  if (isLoading) {
    return (
      <div className="mt-1 space-y-10">
        <CategorySkeleton />
        <CategorySkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
        <section key={category} className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {category}
            </h2>
            <div className="mt-2 h-px bg-border" />
          </div>

          <div className="space-y-3 pl-3 sm:pl-3 pr-3 sm:pr-3">
            {categoryProducts.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                description={product.description}
                imageS3Key={product.imageUrl}
                isSelected={selectedProductId === product.id}
                onSelect={onProductSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>


  );
}
