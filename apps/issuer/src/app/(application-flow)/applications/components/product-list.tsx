"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectionCard } from "@/app/(application-flow)/applications/components/selection-card";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { ProductImagePreview } from "./product-image-preview";



function ProductCardSkeleton() {
  return (
    <div className="block w-full">
      <div className="w-full rounded-xl border border-input bg-card px-4 py-3 min-h-[80px] flex items-center">
        <div className="flex w-full justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Image */}
            <div className="w-14 h-14 rounded-xl border border-input bg-muted overflow-hidden flex items-center justify-center shrink-0">
              <Skeleton className="h-full w-full" />
            </div>

            {/* Text - name and description */}
            <div className="min-w-0 flex-1">
              <div className="space-y-1">
                <Skeleton className="h-5 w-[62%] rounded" />
                <Skeleton className="h-4 w-[78%] rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

}

function CategorySkeleton() {
  return (
    <section className="space-y-3">
      <div>
        {/* Category header — VERY SLIGHTLY higher */}
        <Skeleton className="h-[24px] w-[160px] rounded" />
        <div className="border-b border-border" />
      </div>

      <div className="space-y-3 px-3">
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </div>
    </section>
  );
}





// PRODUCT IMAGE handled by ProductImagePreview component (shared standard)



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
  disabled?: boolean;
}

function ProductCard({ id, name, description, imageS3Key, isSelected, onSelect, disabled }: ProductCardProps) {
  return (
    <SelectionCard
      title={name}
      description={description}
      isSelected={isSelected}
      onClick={disabled ? () => {} : () => onSelect(id)}
      disabled={disabled}
      leading={<ProductImagePreview s3Key={imageS3Key} alt={name} />}
      className="space-y-0"
    />
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
  products: any[]; // Accept any product structure from API
  selectedProductId: string;
  onProductSelect: (productId: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ProductList({ products, selectedProductId, onProductSelect, isLoading, disabled }: ProductListProps) {
  /**
   * Group products by category_name and sort by display order fields.
   * Falls back to workflow config if category fields missing.
   */
  const categories = React.useMemo(() => {
    type CatEntry = {
      name: string;
      displayOrder: number | null;
      items: {
        id: string;
        name: string;
        description: string;
        imageUrl: string;
        productDisplayOrder: number | null;
        created_at?: string;
      }[];
    };

    const map = new Map<string, CatEntry>();

    products.forEach((product: any) => {
      const financingStep = product.workflow?.find((step: any) =>
        String(step?.name).toLowerCase().includes("financing type")
      );
      const config = financingStep?.config || {};

      const categoryName = product.category_name || config.category || "Other";
      const categoryDisplayOrder = product.category_display_order ?? config.category_display_order ?? null;
      const productDisplayOrder = product.product_display_order ?? config.product_display_order ?? null;

      const name = config.name || (product.workflow?.[0]?.config?.name as string) || "Unnamed Product";
      const description = config.description || "";
      const imageUrl = config.image?.s3_key || config.s3_key || "";

      if (!map.has(categoryName)) {
        map.set(categoryName, { name: categoryName, displayOrder: categoryDisplayOrder, items: [] });
      }
      map.get(categoryName)!.items.push({
        id: product.id,
        name,
        description,
        imageUrl,
        productDisplayOrder,
        created_at: product.created_at ? new Date(product.created_at).toISOString() : undefined,
      });
    });

    // Convert map to array and sort categories/products by display order (nulls -> large)
    const result = Array.from(map.values());
    result.forEach((cat) => {
      cat.items.sort((a, b) => {
        const oa = a.productDisplayOrder ?? 999999;
        const ob = b.productDisplayOrder ?? 999999;
        if (oa !== ob) return oa - ob;
        // tie-breaker
        if (a.created_at && b.created_at) return a.created_at.localeCompare(b.created_at);
        return 0;
      });
    });
    result.sort((a, b) => {
      const ca = a.displayOrder ?? 999999;
      const cb = b.displayOrder ?? 999999;
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [products]);

  if (isLoading) {
    return (
      <div className="mt-1 space-y-10">
        <CategorySkeleton />
        <CategorySkeleton />
      </div>
    );
  }

  // Collapsible categories state - allow multiple expanded
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (categories.length > 0 && Object.keys(expandedCategories).length === 0) {
      // Expand first category by default
      setExpandedCategories({ [categories[0].name]: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  return (
    <div className="space-y-6">
      {categories.map((cat) => {
        const isExpanded = Boolean(expandedCategories[cat.name]);
        return (
          <section key={cat.name}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setExpandedCategories((prev) => ({ ...prev, [cat.name]: !prev[cat.name] }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedCategories((prev) => ({ ...prev, [cat.name]: !prev[cat.name] }))
                    }
                  }}
                  className="flex items-center gap-3 text-left cursor-pointer w-full"
                >
                  {/* Chevron */}
                  <ChevronDownIcon
                    className={`h-5 w-5 text-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                  <h2 className="text-base font-semibold text-foreground truncate">{cat.name}</h2>
                </div>
              </div>

              {cat.items.length >= 1 ? (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {cat.items.length} option{cat.items.length > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>

            <div className="border-b border-border mt-2 mb-4" />

            {isExpanded && (
              <div className="space-y-3 px-3">
                {cat.items.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    description={product.description}
                    imageS3Key={product.imageUrl}
                    isSelected={selectedProductId === product.id}
                    onSelect={onProductSelect}
                    disabled={disabled}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
