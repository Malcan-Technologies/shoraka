"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectionCard } from "@/app/(application-flow)/applications/components/selection-card";
import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { ProductImagePreview } from "./product-image-preview";

/** Max product cards shown per category before "Show more" (scroll stays primary; this limits height). */
const VISIBLE_PRODUCTS_PER_CATEGORY = 8;

/**
 * Search field, expand/collapse-all, and no-match empty state.
 * Set to true when you want those controls visible; logic stays in this file.
 */
const SHOW_PRODUCT_LIST_EXTENDED_CONTROLS = false;

/** Lowercase blob for client-side search (name, description, category). */
function productSearchText(product: any): string {
  const financingStep = product.workflow?.find((step: any) =>
    String(step?.name).toLowerCase().includes("financing type")
  );
  const config = financingStep?.config || {};
  const categoryName = product.category_name || config.category || "Other";
  const name = config.name || (product.workflow?.[0]?.config?.name as string) || "Unnamed Product";
  const description = config.description || "";
  return `${name} ${description} ${categoryName}`.toLowerCase();
}



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
  /** When true, shows search + expand/collapse-all (same as SHOW_PRODUCT_LIST_EXTENDED_CONTROLS). */
  showExtendedControls?: boolean;
}

export function ProductList({
  products,
  selectedProductId,
  onProductSelect,
  isLoading,
  disabled,
  showExtendedControls = false,
}: ProductListProps) {
  const extendedUi = SHOW_PRODUCT_LIST_EXTENDED_CONTROLS || showExtendedControls;
  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});
  const [showAllInCategory, setShowAllInCategory] = React.useState<Record<string, boolean>>({});

  const filteredProducts = React.useMemo(() => {
    if (!extendedUi) return products;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => productSearchText(p).includes(q));
  }, [products, searchQuery, extendedUi]);

  /**
   * Group products by category_name and sort by admin display order (product + category).
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

    filteredProducts.forEach((product: any) => {
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

    const result = Array.from(map.values());
    result.forEach((cat) => {
      cat.items.sort((a, b) => {
        const oa = a.productDisplayOrder ?? 999999;
        const ob = b.productDisplayOrder ?? 999999;
        if (oa !== ob) return oa - ob;
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
  }, [filteredProducts]);

  React.useEffect(() => {
    if (!extendedUi) return;
    const q = searchQuery.trim();
    if (!q || categories.length === 0) return;
    setExpandedCategories((prev) => {
      const next = { ...prev };
      categories.forEach((c) => {
        next[c.name] = true;
      });
      return next;
    });
  }, [extendedUi, searchQuery, categories]);

  React.useEffect(() => {
    if (categories.length === 0) return;
    if (!selectedProductId?.trim()) {
      setExpandedCategories((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        return { [categories[0].name]: true };
      });
      return;
    }
    const cat = categories.find((c) => c.items.some((i) => i.id === selectedProductId));
    if (!cat) return;
    setExpandedCategories((prev) => ({ ...prev, [cat.name]: true }));
    const idx = cat.items.findIndex((i) => i.id === selectedProductId);
    if (idx >= VISIBLE_PRODUCTS_PER_CATEGORY) {
      setShowAllInCategory((prev) => ({ ...prev, [cat.name]: true }));
    }
  }, [categories, selectedProductId]);

  if (isLoading) {
    return (
      <div className="mt-1 space-y-10">
        <CategorySkeleton />
        <CategorySkeleton />
      </div>
    );
  }

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    categories.forEach((c) => {
      next[c.name] = true;
    });
    setExpandedCategories(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    categories.forEach((c) => {
      next[c.name] = false;
    });
    setExpandedCategories(next);
  };

  const noSearchMatches =
    extendedUi &&
    products.length > 0 &&
    categories.length === 0 &&
    Boolean(searchQuery.trim());

  return (
    <div className="space-y-6">
      {extendedUi && products.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, description, or category"
              className="h-11 rounded-xl pl-9 pr-3 text-[15px] leading-6"
              aria-label="Search financing products"
              disabled={disabled}
            />
          </div>
          {categories.length > 1 ? (
            <div className="flex flex-wrap items-center justify-end gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={expandAll}>
                Expand all
              </Button>
              <span className="text-muted-foreground text-xs" aria-hidden>
                ·
              </span>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={collapseAll}>
                Collapse all
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {noSearchMatches ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-10 text-center">
          <p className="font-medium text-foreground">No products match your search</p>
          <p className="mt-1 text-[15px] leading-7 text-muted-foreground">Try a different keyword.</p>
          <Button
            type="button"
            variant="link"
            className="mt-2 text-primary"
            onClick={() => setSearchQuery("")}
          >
            Clear search
          </Button>
        </div>
      ) : null}

      {!noSearchMatches &&
        categories.map((cat) => {
        const isExpanded = Boolean(expandedCategories[cat.name]);
        const showAll = Boolean(showAllInCategory[cat.name]);
        const total = cat.items.length;
        const visibleLimit = Math.min(VISIBLE_PRODUCTS_PER_CATEGORY, total);
        const hasMore = total > VISIBLE_PRODUCTS_PER_CATEGORY;
        const visibleItems = showAll || !hasMore ? cat.items : cat.items.slice(0, visibleLimit);
        const hiddenCount = total - visibleLimit;

        return (
          <section key={cat.name}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setExpandedCategories((prev) => ({ ...prev, [cat.name]: !prev[cat.name] }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedCategories((prev) => ({ ...prev, [cat.name]: !prev[cat.name] }));
                    }
                  }}
                  className="flex items-center gap-3 text-left cursor-pointer min-w-0"
                >
                  <ChevronDownIcon
                    className={`h-5 w-5 shrink-0 text-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                  <h2 className="text-base font-semibold text-foreground truncate">{cat.name}</h2>
                </div>
              </div>

              {cat.items.length >= 1 ? (
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {cat.items.length} option{cat.items.length > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>

            <div className="border-b border-border mt-2 mb-4" />

            {isExpanded && (
              <div className="space-y-3 px-3">
                {visibleItems.map((product) => (
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
                {hasMore && !showAll ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl border-dashed"
                    onClick={() =>
                      setShowAllInCategory((prev) => ({
                        ...prev,
                        [cat.name]: true,
                      }))
                    }
                  >
                    Show {hiddenCount} more
                  </Button>
                ) : null}
                {hasMore && showAll ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() =>
                      setShowAllInCategory((prev) => ({
                        ...prev,
                        [cat.name]: false,
                      }))
                    }
                  >
                    Show less
                  </Button>
                ) : null}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
