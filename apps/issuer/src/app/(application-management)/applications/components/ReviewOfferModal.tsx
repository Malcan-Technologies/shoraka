"use client";

/**
 * Modal for reviewing contract or invoice offers. Issuer can download offer letter,
 * accept, or reject. No digital signing in this phase.
 * Rejection reason section is shown only when user chooses to reject.
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { ArrowDownTrayIcon, CheckCircleIcon } from "@heroicons/react/24/solid";
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
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [isRejectMode, setIsRejectMode] = React.useState(false);

  const contractDetails = (contractRecord as { contract_details?: Record<string, unknown> } | null)
    ?.contract_details;
  const contractName =
    type === "contract"
      ? (contractDetails?.title ?? contractDetails?.contract_title
          ? String(contractDetails.title ?? contractDetails.contract_title)
          : "—")
      : invoice?.number ?? "Invoice financing";

  const handleDownload = async () => {
    if (type === "invoice" && !invoice?.id) {
      toast.error("Cannot download", {
        description: "Invoice ID is missing. Please refresh and try again.",
      });
      return;
    }
    setDownloading(true);
    try {
      const blob =
        type === "contract"
          ? await apiClient.getContractOfferLetterBlob(applicationId)
          : await apiClient.getInvoiceOfferLetterBlob(applicationId, invoice!.id);
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
        await rejectContract.mutateAsync({ applicationId, reason: rejectionReason || undefined });
        toast.success("Offer rejected");
        onClose();
      } catch {
        // toast handled by hook
      }
    } else {
      if (!invoice?.id) return;
      try {
        await rejectInvoice.mutateAsync({
          applicationId,
          invoiceId: invoice.id,
          reason: rejectionReason || undefined,
        });
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
  const expiresAt = od?.expires_at
    ? format(new Date(String(od.expires_at)), "d MMM yyyy")
    : "—";

  const isPending =
    acceptContract.isPending ||
    rejectContract.isPending ||
    acceptInvoice.isPending ||
    rejectInvoice.isPending;

  const canDownload =
    type === "contract" || (type === "invoice" && !!invoice?.id);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px] gap-3 p-4">
        <DialogTitle className="sr-only">
          Financing offer approved — Review and respond
        </DialogTitle>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6">Loading offer...</p>
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-slate-700 p-2 mb-2">
                <CheckCircleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-0.5">
                <p className="text-base font-semibold">
                  Congratulations! Your financing request
                </p>
                <p className="text-xl font-bold text-red-700">
                  {offeredValue}
                </p>
                <p className="text-base font-semibold">
                  has been approved
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm py-2 border-t">
              <dt className="text-muted-foreground">
                {type === "contract" ? "Contract name:" : "Invoice:"}
              </dt>
              <dd className="font-medium text-foreground text-right tabular-nums">
                {contractName}
              </dd>
              <dt className="text-muted-foreground">Approved facility:</dt>
              <dd className="font-medium text-foreground text-right tabular-nums">
                {offeredValue}
              </dd>
              <dt className="text-muted-foreground">
                {type === "contract" ? "Contract end date:" : "Expires:"}
              </dt>
              <dd className="font-medium text-foreground text-right tabular-nums">
                {expiresAt}
              </dd>
            </dl>

            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!canDownload || downloading}
                className="shrink-0 h-8"
              >
                <ArrowDownTrayIcon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                Download offer letter
              </Button>
            </div>

            {!isRejectMode ? (
              <div className="flex gap-2 justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRejectMode(true)}
                  disabled={isPending}
                  className="h-8 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border-red-200"
                >
                  Reject offer
                </Button>
                <Button
                  size="sm"
                  onClick={handleAccept}
                  disabled={isPending}
                  className="h-8 bg-teal-600 hover:bg-teal-700 text-white shrink-0"
                >
                  Accept and sign offer
                </Button>
              </div>
            ) : (
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="rejection-reason" className="text-sm text-muted-foreground">
                  Please provide a reason for rejecting this offer?
                </Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Enter reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {rejectionReason.length}/200 characters
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsRejectMode(false)}
                  disabled={isPending}
                  className="h-7 text-muted-foreground -ml-2"
                >
                  Back to accept or reject
                </Button>
              </div>
            )}

            <DialogFooter className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Please respond to this offer by {expiresAt}.
              </p>
              {isRejectMode && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReject}
                  disabled={isPending}
                  className="h-8 shrink-0"
                >
                  <CheckCircleIcon className="h-3.5 w-3.5 mr-1.5" />
                  Confirm rejection
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
