"use client";

import * as React from "react";
import { useIssuerProducts } from "@/hooks/use-products";
import { SelectionCard } from "../components/selection-card";
import { ProductImagePreview } from "../components/product-image-preview";
import { FinancingTypeSkeleton } from "@/app/(application-flow)/applications/components/financing-type-skeleton";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";
import {
  applicationFlowSectionDividerClassName,
  applicationFlowSectionTitleClassName,
  applicationFlowStepHorizontalClassName,
} from "@/app/(application-flow)/applications/components/form-control";

/**
 * FINANCING TYPE STEP (edit flow)
 *
 * Shows the application's saved product only via issuer catalog (same source as /applications/new).
 * Product cannot be changed here — start a new application to select a different product.
 */
interface FinancingTypeStepProps {
  initialProductId?: string;
  onDataChange?: (data: { product_id: string; hasPendingChanges: boolean }) => void;
  readOnly?: boolean;
}

export function FinancingTypeStep({
  initialProductId,
  onDataChange,
}: FinancingTypeStepProps) {
  const devTools = useDevTools();

  const { data: productsData, isLoading: isLoadingProducts } = useIssuerProducts(
    { page: 1, pageSize: 100 },
    { staleTime: 0, refetchOnMount: true }
  );

  const allProducts = React.useMemo(
    () =>
      (((productsData as { products?: Array<{ id: string; workflow?: unknown[] }> })?.products ||
        []) as Array<{ id: string; workflow?: unknown[] }>),
    [productsData]
  );
  const productList = React.useMemo(() => {
    if (!initialProductId?.trim()) return [];
    return allProducts.filter((p) => p.id === initialProductId);
  }, [allProducts, initialProductId]);

  const [selectedProductId, setSelectedProductId] = React.useState<string>("");

  React.useEffect(() => {
    if (initialProductId && !selectedProductId) {
      setSelectedProductId(initialProductId);
      if (onDataChange) {
        onDataChange({
          product_id: initialProductId,
          hasPendingChanges: false,
        });
      }
    }
  }, [initialProductId, selectedProductId, onDataChange]);

  if (isLoadingProducts || devTools?.showSkeletonDebug) {
    return <FinancingTypeSkeleton />;
  }

  if (!initialProductId?.trim()) {
    return (
      <div className="text-center py-12 px-4 max-w-lg mx-auto space-y-2 text-muted-foreground">
        <p className="font-medium text-foreground">No financing product on this application</p>
        <p className="text-[15px] leading-7">
          Start a new application to choose a product, or contact support if this looks wrong.
        </p>
      </div>
    );
  }

  if (productList.length === 0) {
    return (
      <div className="text-center py-12 px-4 max-w-lg mx-auto space-y-2 text-muted-foreground">
        <p className="font-medium text-foreground">Financing product not in the active catalog</p>
        <p className="text-[15px] leading-7">
          This application&apos;s product is no longer listed for new applications. You may need to start
          a new application with a current product. Contact your administrator if you need help.
        </p>
      </div>
    );
  }

  return (
    <div className={applicationFlowStepHorizontalClassName}>
      {productList.map((p) => {
        const workflow = p.workflow as Record<string, unknown>[] | undefined;
        const cfg = (workflow?.[0]?.config || {}) as Record<string, unknown>;
        const category = (cfg.category as string) || "Uncategorized";
        const name = (cfg.name as string) || "Unnamed Product";
        const description = (cfg.description as string) || "";
        const image = cfg.image as { s3_key?: string } | undefined;
        return (
          <section key={p.id}>
            <div className="flex items-center justify-between cursor-default">
              <h3 className={applicationFlowSectionTitleClassName}>{category}</h3>
              <span className="text-xs text-muted-foreground">Selected product</span>
            </div>
            <div className={applicationFlowSectionDividerClassName} />

            <div>
              <SelectionCard
                title={name}
                description={description}
                isSelected={true}
                onClick={() => {}}
                disabled={true}
                leading={
                  <ProductImagePreview s3Key={image?.s3_key || ""} alt={name} />
                }
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
