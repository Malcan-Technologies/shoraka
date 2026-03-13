/* Hook: useProductVersionGuard
 *
 * Purpose:
 * - Centralize product version validation for an application.
 * - Expose isMismatch, isChecking and checkNow() for callers to run a live check
 *   (refetches the product to ensure up-to-date comparison).
 */
import * as React from "react";
import { useApplication } from "./use-applications";
import { useProduct } from "./use-products";

export function useProductVersionGuard(applicationId: string) {
  const { data: application } = useApplication(applicationId);

  const productId = React.useMemo(
    () => (application?.financing_type as any)?.product_id as string | undefined,
    [application]
  );

  const {
    data: _product,
    refetch: refetchProduct,
    isFetching: isFetchingProduct,
  } = useProduct(productId || "");

  const [isMismatch, setIsMismatch] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);
  const [blockReason, setBlockReason] = React.useState<"PRODUCT_DELETED" | "PRODUCT_INACTIVE" | "PRODUCT_VERSION_CHANGED" | null>(null);

  const checkNow = React.useCallback(async (): Promise<boolean> => {
    setIsChecking(true);

    if (!application) {
      setIsChecking(false);
      setIsMismatch(false);
      return false;
    }

    /** Amendment flow must skip all product validation; use original product configuration. */
    if ((application as { status?: string }).status === "AMENDMENT_REQUESTED") {
      setIsMismatch(false);
      setBlockReason(null);
      setIsChecking(false);
      return false;
    }

    if (!productId) {
      // No product selected on application — treat as no mismatch here (higher-level logic may block)
      setIsChecking(false);
      setIsMismatch(false);
      return false;
    }

    try {
      const latestResult = await refetchProduct();
      const latestProduct = latestResult?.data;

      if (!latestProduct) {
        // Product not found -> mismatch (deleted)
        setIsMismatch(true);
        setBlockReason("PRODUCT_DELETED");
        setIsChecking(false);
        return true;
      }

      // Use product.status lifecycle: DELETED -> INACTIVE -> version comparison
      const status = (latestProduct as any).status as string | undefined;
      if (status === "DELETED") {
        setIsMismatch(true);
        setBlockReason("PRODUCT_DELETED");
        setIsChecking(false);
        return true;
      }

      if (status === "INACTIVE") {
        setIsMismatch(true);
        setBlockReason("PRODUCT_INACTIVE");
        setIsChecking(false);
        return true;
      }

      const mismatch = latestProduct.version !== (application.product_version as number);
      setIsMismatch(mismatch);
      setBlockReason(mismatch ? "PRODUCT_VERSION_CHANGED" : null);
      setIsChecking(false);
      return mismatch;
    } catch (err) {
      // On error, be conservative and treat as mismatch
      setIsMismatch(true);
      setBlockReason("PRODUCT_VERSION_CHANGED");
      setIsChecking(false);
      return true;
    }
  }, [application, productId, refetchProduct]);

  React.useEffect(() => {
    // Run an initial quick check when application or selected product changes
    if (!application) return;
    // fire-and-forget; checkNow will update state
    checkNow();
  }, [application, checkNow]);

  return {
    isMismatch,
    isChecking: isChecking || isFetchingProduct,
    blockReason,
    checkNow,
  };
}

