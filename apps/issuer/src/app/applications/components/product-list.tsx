"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useS3ViewUrl } from "@/hooks/use-s3";
import { SelectionCard } from "@/app/applications/components/selection-card";



function ProductCardSkeleton() {
  return (
    <div className="block w-full">
      <div className="w-full rounded-xl border border-border bg-background px-6 py-3">
          <div className="flex items-start gap-4">
            {/* Image */}
            <div className="shrink-0">
              <div className="h-14 w-14 rounded-md border border-border bg-white overflow-hidden">
                <Skeleton className="h-full w-full" />
              </div>
            </div>

            {/* Text - name and description */}
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-6 w-[62%] rounded" />
              <Skeleton className="h-5 w-[78%] rounded" />
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
        <Skeleton className="h-[24px] w-[160px] rounded" />
        <div className="mt-2 h-px bg-border" />
      </div>

      <div className="space-y-3 px-3">
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
    return <Skeleton className="h-full w-full rounded-md" />;
  }

  if (!imageUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
        {/* Fallback if image missing */}
        <div className="w-10 h-10 rounded-md bg-muted" />
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
    <SelectionCard
      title={name}
      description={description}
      isSelected={isSelected}
      onClick={() => onSelect(id)}
      leading={
        <div className="w-12 h-12 rounded-lg border border-input bg-muted flex items-center justify-center overflow-hidden">
          <ProductImage s3Key={imageS3Key} alt={name} />
        </div>
      }
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
}

export function ProductList({ products, selectedProductId, onProductSelect, isLoading }: ProductListProps) {
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
          <section key={cat.name} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedCategories((prev) => ({ ...prev, [cat.name]: !prev[cat.name] }))
                  }
                  className="flex items-center gap-2 text-left"
                >
                  {/* Chevron */}
                  <svg
                    className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <path d="M6 8L10 12L14 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <h2 className="text-xl font-semibold text-foreground truncate">{cat.name}</h2>
                </button>
              </div>

              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {cat.items.length} items
              </span>
            </div>

            <div className="border-b border-border mt-4 mb-4" />

            {isExpanded && (
              <div className="space-y-4 px-3">
                {cat.items.map((product) => (
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
            )}
          </section>
        );
      })}
    </div>
  );
}
