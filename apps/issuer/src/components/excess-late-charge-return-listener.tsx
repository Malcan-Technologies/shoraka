"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildIssuerExcessLateChargeCallbackUrl,
  openCurlecFpxCheckout,
  resolvePortalCheckoutPayer,
  useAuthToken,
  useOrganization,
} from "@cashsouk/config";
import { ExcessLateChargeReturnDialog } from "@/components/excess-late-charge-return-dialog";
import {
  isExcessLateChargeHeldError,
  useCreateExcessLateChargePaymentMutation,
} from "@/hooks/use-excess-late-charge-payment";
import {
  EXCESS_LATE_CHARGE_RETURN_QUERY,
  buildExcessLateChargeNoteReturnTo,
  parseNoteIdFromFinancingPath,
  sanitizeExcessLateChargePaymentId,
} from "@/lib/excess-late-charge-payment-routes";
import {
  mapExcessLateChargeOwnershipError,
  nextExcessLateChargeReturnPinState,
  resolveExcessLateChargeReturnPaymentId,
  type ExcessLateChargeReturnPinState,
} from "@/lib/excess-late-charge-payment-ui";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function ExcessLateChargeReturnListener({ noteId }: { noteId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { getAccessToken } = useAuthToken();
  const { activeOrganization } = useOrganization();
  const createPayment = useCreateExcessLateChargePaymentMutation();
  const [isPayingNext, setIsPayingNext] = React.useState(false);

  const urlPaymentId = sanitizeExcessLateChargePaymentId(
    searchParams.get(EXCESS_LATE_CHARGE_RETURN_QUERY)
  );
  const pathNoteId = parseNoteIdFromFinancingPath(pathname) ?? noteId;

  const [pinState, setPinState] = React.useState<ExcessLateChargeReturnPinState>(() => ({
    pinnedPaymentId: urlPaymentId,
    dismissed: false,
  }));

  React.useEffect(() => {
    setPinState((current) => nextExcessLateChargeReturnPinState(current, urlPaymentId));
  }, [urlPaymentId]);

  const paymentId = resolveExcessLateChargeReturnPaymentId(pinState);

  const clearReturnMarker = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(EXCESS_LATE_CHARGE_RETURN_QUERY);
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

      const payment = await createPayment.mutateAsync(pathNoteId);
      if (payment.status === "HELD") {
        dismiss();
        return;
      }

      const callbackUrl = buildIssuerExcessLateChargeCallbackUrl(
        payment.id,
        buildExcessLateChargeNoteReturnTo(pathNoteId)
      );

      await openCurlecFpxCheckout({
        keyId: payment.curlecKeyId,
        orderId: payment.curlecOrderId,
        amountMyr: payment.amount,
        callbackUrl,
        description: "Late payment charges",
        prefillName: checkoutContact.name ?? "Issuer",
        prefillEmail: checkoutContact.email,
        prefillContact: checkoutContact.contact,
      });
    } catch (error) {
      if (isExcessLateChargeHeldError(error)) {
        dismiss();
        return;
      }
      toast.error(mapExcessLateChargeOwnershipError(error));
    } finally {
      setIsPayingNext(false);
    }
  }, [
    activeOrganization,
    createPayment,
    dismiss,
    getAccessToken,
    isPayingNext,
    pathNoteId,
  ]);

  if (!paymentId || !pathNoteId) {
    return null;
  }

  return (
    <ExcessLateChargeReturnDialog
      noteId={pathNoteId}
      paymentId={paymentId}
      open
      onDismiss={dismiss}
      onPayNext={() => void payNext()}
      isPayingNext={isPayingNext || createPayment.isPending}
    />
  );
}
