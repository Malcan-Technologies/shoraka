"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildIssuerFacilityFeeCallbackUrl,
  openCurlecFpxCheckout,
  resolvePortalCheckoutPayer,
  useAuthToken,
  useOrganization,
} from "@cashsouk/config";
import { FacilityFeeReturnDialog } from "@/components/facility-fee-return-dialog";
import {
  isFacilityFeeHeldError,
  useCreateFacilityFeePaymentMutation,
} from "@/hooks/use-facility-fee-payment";
import {
  FACILITY_FEE_RETURN_QUERY,
  buildFacilityFeeContractReturnTo,
  parseContractIdFromFinancingPath,
  sanitizeFacilityFeePaymentId,
} from "@/lib/facility-fee-payment-routes";
import {
  mapFacilityFeeOwnershipError,
  nextFacilityFeeReturnPinState,
  resolveFacilityFeeReturnPaymentId,
  type FacilityFeeReturnPinState,
} from "@/lib/facility-fee-payment-ui";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function FacilityFeeReturnListener({ contractId }: { contractId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { getAccessToken } = useAuthToken();
  const { activeOrganization } = useOrganization();
  const createPayment = useCreateFacilityFeePaymentMutation();
  const [isPayingNext, setIsPayingNext] = React.useState(false);

  const urlPaymentId = sanitizeFacilityFeePaymentId(searchParams.get(FACILITY_FEE_RETURN_QUERY));
  const pathContractId = parseContractIdFromFinancingPath(pathname) ?? contractId;

  const [pinState, setPinState] = React.useState<FacilityFeeReturnPinState>(() => ({
    pinnedPaymentId: urlPaymentId,
    dismissed: false,
  }));

  React.useEffect(() => {
    setPinState((current) => nextFacilityFeeReturnPinState(current, urlPaymentId));
  }, [urlPaymentId]);

  const paymentId = resolveFacilityFeeReturnPaymentId(pinState);

  const clearReturnMarker = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(FACILITY_FEE_RETURN_QUERY);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const dismiss = React.useCallback(() => {
    setPinState((current) => ({ ...current, dismissed: true }));
    clearReturnMarker();
  }, [clearReturnMarker]);

  const payNext = React.useCallback(async () => {
    if (isPayingNext || createPayment.isPending) return;
    setIsPayingNext(true);
    try {
      const checkoutContact = await resolvePortalCheckoutPayer({
        apiUrl: API_URL,
        getAccessToken,
        organization: activeOrganization,
      });
      if (!checkoutContact.email) {
        toast.error("We could not find an email address for this account");
        return;
      }

      const payment = await createPayment.mutateAsync(pathContractId);
      if (payment.status === "HELD") {
        dismiss();
        return;
      }

      const callbackUrl = buildIssuerFacilityFeeCallbackUrl(
        payment.id,
        buildFacilityFeeContractReturnTo(pathContractId)
      );

      await openCurlecFpxCheckout({
        keyId: payment.curlecKeyId,
        orderId: payment.curlecOrderId,
        amountMyr: payment.amount,
        callbackUrl,
        description: "Upfront facility fee",
        prefillName: checkoutContact.name ?? "Issuer",
        prefillEmail: checkoutContact.email,
        prefillContact: checkoutContact.contact,
      });
    } catch (error) {
      if (isFacilityFeeHeldError(error)) {
        dismiss();
        return;
      }
      toast.error(mapFacilityFeeOwnershipError(error));
    } finally {
      setIsPayingNext(false);
    }
  }, [
    activeOrganization,
    createPayment,
    dismiss,
    getAccessToken,
    isPayingNext,
    pathContractId,
  ]);

  if (!paymentId || !pathContractId) {
    return null;
  }

  return (
    <FacilityFeeReturnDialog
      contractId={pathContractId}
      paymentId={paymentId}
      open
      onDismiss={dismiss}
      onPayNext={() => void payNext()}
      isPayingNext={isPayingNext || createPayment.isPending}
    />
  );
}
