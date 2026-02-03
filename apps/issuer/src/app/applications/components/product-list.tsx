"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useS3ViewUrl } from "@/hooks/use-s3";

/**
 * PRODUCT IMAGE
 * 
 * Shows product image from S3.
 * If image is loading or missing, shows placeholder.
 */
function ProductImage({ s3Key, alt }: { s3Key: string; alt: string }) {
  const { data: imageUrl, isLoading } = useS3ViewUrl(s3Key);

  if (isLoading) {
    return <Skeleton className="w-full h-full" />;
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
      className={`
        relative flex items-start gap-3 sm:gap-4 border rounded-xl p-3 sm:p-4 cursor-pointer 
        transition-colors
        ${isSelected ? "border-primary" : "border-border hover:border-primary/50"}
      `}
      onClick={() => onSelect(id)}
    >
      {/* Product Image */}
      <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
        <ProductImage s3Key={imageS3Key} alt={name} />
      </div>
      
      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base sm:text-lg leading-6 sm:leading-7">
          {name}
        </div>
        <div className="text-muted-foreground text-sm sm:text-base leading-5 sm:leading-6">
          {description}
        </div>
      </div>
      
      {/* Checkbox */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
        <Checkbox
          checked={isSelected}
          className="rounded"
        />
      </div>
    </label>
  );
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
}

export function ProductList({ products, selectedProductId, onProductSelect }: ProductListProps) {
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
  
  return (
    <div className="space-y-6 sm:space-y-8">
      {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
        <div key={category} className="space-y-3 sm:space-y-4">
          {/* Category Header */}
          <div>
            <h2 className="text-lg sm:text-xl font-semibold">{category}</h2>
            <div className="mt-2 h-px bg-border" />
          </div>
          
          {/* Products in this category */}
          <div className="space-y-3 sm:space-y-4 pl-3 sm:pl-6">
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
        </div>
      ))}
    </div>
  );
}
