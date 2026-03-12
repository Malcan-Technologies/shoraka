"use client";

/**
 * Modal for reviewing contract or invoice offers. Issuer can download offer letter,
 * accept, or reject. No digital signing in this phase.
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useContract } from "@/hooks/use-contracts";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  useAcceptContractOffer,
  useRejectContractOffer,
  useAcceptInvoiceOffer,
  useRejectInvoiceOffer,
} from "@/hooks/use-applications";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import type { NormalizedInvoice } from "../status";

type ReviewOfferModalProps = {
  type: "contract" | "invoice";
  applicationId: string;
  contractId?: string;
  invoice?: NormalizedInvoice | null;
  onClose: () => void;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Only mounted when Review Offer is clicked. Renders once, no isOpen toggle to avoid flash. */
export function ReviewOfferModal({
  type,
  applicationId,
  contractId,
  invoice,
  onClose,
}: ReviewOfferModalProps) {
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(
    () => createApiClient(API_URL, getAccessToken),
    [getAccessToken]
  );

  const { data: contractRecord, isLoading: isLoadingContract } = useContract(
    type === "contract" && contractId ? contractId : ""
  );

  const acceptContract = useAcceptContractOffer();
  const rejectContract = useRejectContractOffer();
  const acceptInvoice = useAcceptInvoiceOffer();
  const rejectInvoice = useRejectInvoiceOffer();

  const offerDetails =
    type === "contract"
      ? (contractRecord as { offer_details?: Record<string, unknown> } | null)
          ?.offer_details
      : (invoice as { offer_details?: Record<string, unknown> } | undefined)
          ?.offer_details;
  const od = offerDetails as Record<string, unknown> | null | undefined;

  const isLoading = type === "contract" && isLoadingContract;

  const [downloading, setDownloading] = React.useState(false);

  const title =
    type === "contract" ? "Contract Financing Offer" : "Invoice Financing Offer";

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob =
        type === "contract"
          ? await apiClient.getContractOfferLetterBlob(applicationId)
          : await apiClient.getInvoiceOfferLetterBlob(
              applicationId,
              invoice?.id ?? ""
            );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        type === "contract"
          ? `contract-offer-${contractId}.pdf`
          : `invoice-offer-${invoice?.id ?? "letter"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Failed to download offer letter", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleReject = async () => {
    if (type === "contract") {
      try {
        await rejectContract.mutateAsync(applicationId);
        toast.success("Offer rejected");
        onClose();
      } catch {
        // toast handled by hook
      }
    } else {
      if (!invoice?.id) return;
      try {
        await rejectInvoice.mutateAsync({ applicationId, invoiceId: invoice.id });
        toast.success("Offer rejected");
        onClose();
      } catch {
        // toast handled by hook
      }
    }
  };

  const handleAccept = async () => {
    if (type === "contract") {
      try {
        await acceptContract.mutateAsync(applicationId);
        toast.success("Offer accepted successfully");
        onClose();
      } catch {
        // toast handled by hook
      }
    } else {
      if (!invoice?.id) return;
      try {
        await acceptInvoice.mutateAsync({ applicationId, invoiceId: invoice.id });
        toast.success("Offer accepted successfully");
        onClose();
      } catch {
        // toast handled by hook
      }
    }
  };

  const offeredValue =
    type === "contract"
      ? od?.offered_facility != null
        ? formatCurrency(Number(od.offered_facility))
        : "—"
      : od?.offered_amount != null
        ? formatCurrency(Number(od.offered_amount))
        : "—";
  const requestedValue =
    type === "contract"
      ? od?.requested_facility != null
        ? formatCurrency(Number(od.requested_facility))
        : "—"
      : od?.requested_amount != null
        ? formatCurrency(Number(od.requested_amount))
        : "—";
  const expiresAt = od?.expires_at
    ? format(new Date(String(od.expires_at)), "d MMM yyyy")
    : "—";

  const isPending =
    acceptContract.isPending ||
    rejectContract.isPending ||
    acceptInvoice.isPending ||
    rejectInvoice.isPending;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading offer...</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Requested: {requestedValue}
              </p>
              <p className="text-sm text-muted-foreground">
                Offered: {offeredValue}
              </p>
              {type === "invoice" && od?.offered_profit_rate_percent != null && (
                <p className="text-sm text-muted-foreground">
                  Profit rate: {Number(od.offered_profit_rate_percent)}%
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Expires: {expiresAt}
              </p>
            </>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isLoading || downloading}
            className="w-full sm:w-auto shrink-0"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2 shrink-0" />
            <span className="truncate">Download offer letter</span>
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-1 sm:justify-end">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Close
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              disabled={isLoading || isPending}
            >
              Reject Offer
            </Button>
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={isLoading || isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white shrink-0"
            >
              Accept Offer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
