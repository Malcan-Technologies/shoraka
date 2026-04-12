/**
 * SECTION: Product version guard (issuer edit flow)
 * WHY: Block or warn when the live product edition no longer matches the application's saved product_version.
 * INPUT: applicationId, issuer session (via API client).
 * OUTPUT: isMismatch, isChecking, blockReason, checkNow().
 * WHERE USED: applications edit page and navigation guards.
 */
import * as React from "react";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { IssuerProductBlockReason } from "@cashsouk/types";
import { useApplication } from "./use-applications";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useProductVersionGuard(applicationId: string) {
  const { data: application } = useApplication(applicationId);
  const { getAccessToken } = useAuthToken();

  const productId = React.useMemo(
    () => (application?.financing_type as { product_id?: string })?.product_id as string | undefined,
    [application]
  );

  const [isMismatch, setIsMismatch] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);
  const [blockReason, setBlockReason] = React.useState<IssuerProductBlockReason>(null);

  const checkNow = React.useCallback(async (): Promise<boolean> => {
    if (!application) {
      setIsChecking(false);
      setIsMismatch(false);
      return false;
    }

    if ((application as { status?: string }).status === "AMENDMENT_REQUESTED") {
      setIsMismatch(false);
      setBlockReason(null);
      setIsChecking(false);
      return false;
    }

    if (isMismatch) {
      setIsChecking(false);
      return true;
    }

    setIsChecking(true);

    if (!productId?.trim()) {
      console.log("[VERSION CHECK] no product_id on application — PRODUCT_UNAVAILABLE");
      setIsMismatch(true);
      setBlockReason("PRODUCT_UNAVAILABLE");
      setIsChecking(false);
      return true;
    }

    try {
      const apiClient = createApiClient(API_URL, getAccessToken);
      const response = await apiClient.getApplicationProductVersionCompare(applicationId);

      if (!response.success) {
        console.log("[VERSION CHECK] API error:", response.error?.message);
        setIsMismatch(true);
        setBlockReason("PRODUCT_UNAVAILABLE");
        setIsChecking(false);
        return true;
      }

      const payload = response.data;
      console.log("[VERSION CHECK] outcome:", payload.outcome, "compare_version:", payload.compare_version);
      console.log("application.product_version:", application?.product_version);
      console.log("product_id:", productId);

      if (payload.outcome === "NO_PRODUCT_ID") {
        console.log("[VERSION CHECK] API NO_PRODUCT_ID — PRODUCT_UNAVAILABLE");
        setIsMismatch(true);
        setBlockReason("PRODUCT_UNAVAILABLE");
        setIsChecking(false);
        return true;
      }

      if (payload.outcome === "PRODUCT_UNAVAILABLE") {
        setIsMismatch(true);
        setBlockReason("PRODUCT_UNAVAILABLE");
        setIsChecking(false);
        return true;
      }

      const compareVersion = payload.compare_version!;
      const mismatch = compareVersion !== (application.product_version as number);
      console.log("is version mismatch:", mismatch);

      if (mismatch) {
        console.log("BLOCKING: Product version mismatch detected");
      }

      setIsMismatch(mismatch);
      setBlockReason(mismatch ? "PRODUCT_VERSION_CHANGED" : null);
      setIsChecking(false);
      return mismatch;
    } catch (err) {
      console.log("[VERSION CHECK] exception:", err instanceof Error ? err.message : err);
      setIsMismatch(true);
      setBlockReason("PRODUCT_UNAVAILABLE");
      setIsChecking(false);
      return true;
    }
  }, [application, applicationId, productId, getAccessToken, isMismatch]);

  /**
   * SECTION: Version check on application load
   * WHY: Refresh or open edit URL must show mismatch modal without Save/navigation first.
   * INPUT: applicationId, loaded application from useApplication.
   * OUTPUT: Triggers compare API via checkNow.
   * WHERE USED: applications/[id]/edit via useProductVersionGuard.
   */
  React.useEffect(() => {
    if (!applicationId?.trim() || !application) return;
    console.log("[VERSION CHECK] on load for applicationId:", applicationId);
    void checkNow();
  }, [applicationId, application, checkNow]);

  return {
    isMismatch,
    isChecking,
    blockReason,
    checkNow,
  };
}
