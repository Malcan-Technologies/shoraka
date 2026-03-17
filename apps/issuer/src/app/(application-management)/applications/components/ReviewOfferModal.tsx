"use client";

/**
 * Modal for reviewing contract or invoice offers. Issuer can download offer letter,
 * accept, or reject. CashSouk brand styling per BRANDING.md.
 * Contract end date uses contract_details.end_date; offer expiry shown in footer.
 */

import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import { ArrowDownTrayIcon, CheckIcon, CheckCircleIcon } from "@heroicons/react/24/solid";
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

function formatDateOrDash(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "d MMM yyyy");
}

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

  /** Contract end date from contract_details.end_date; invoice uses offer expiry. */
  const contractEndDate =
    type === "contract" && contractDetails?.end_date
      ? formatDateOrDash(String(contractDetails.end_date))
      : null;
  const expiresAt = od?.expires_at
    ? format(new Date(String(od.expires_at)), "d MMM yyyy")
    : "—";
  const dateLabel =
    type === "contract"
      ? contractEndDate
        ? "Contract end date"
        : "Expires"
      : "Expires";
  const dateValue = type === "contract" && contractEndDate ? contractEndDate : expiresAt;

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

  const isPending =
    acceptContract.isPending ||
    rejectContract.isPending ||
    acceptInvoice.isPending ||
    rejectInvoice.isPending;

  const canDownload =
    type === "contract" || (type === "invoice" && !!invoice?.id);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px] rounded-xl border-border p-6 gap-0">
        <DialogTitle className="sr-only">
          Financing offer approved — Review and respond
        </DialogTitle>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8">Loading offer...</p>
        ) : (
          <>
            <div className="flex flex-col items-center text-center mb-6">
              <div
                className="w-[74px] h-[74px] rounded-full flex items-center justify-center mb-4 shadow-none"
                style={{ background: "#ececec", boxShadow: "none", filter: "none" }}
              >
                <div
                  className="w-[66px] h-[66px] rounded-full flex items-center justify-center shadow-none"
                  style={{ background: "#c4c4c4", boxShadow: "none", filter: "none" }}
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-none"
                    style={{ background: "#000000", boxShadow: "none", filter: "none" }}
                  >
                    <CheckIcon className="h-7 w-7 text-white" />
                  </div>
                </div>
              </div>
              <p className="text-base font-semibold text-foreground">
                Congratulations! Your {type === "contract" ? "contract" : "invoice"} financing request
              </p>
              <p className="text-3xl sm:text-4xl font-extrabold text-primary tracking-tight mt-2">
                {offeredValue}
              </p>
              <p className="text-base font-semibold text-foreground mt-1">
                has been approved
              </p>
            </div>

            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 text-sm py-4 border-y border-border">
              <dt className="text-muted-foreground font-medium">
                {type === "contract" ? "Contract name:" : "Invoice:"}
              </dt>
              <dd className="font-medium text-foreground text-right tabular-nums">
                {contractName}
              </dd>
              <dt className="text-muted-foreground font-medium">Approved facility:</dt>
              <dd className="font-medium text-foreground text-right tabular-nums">
                {offeredValue}
              </dd>
              <dt className="text-muted-foreground font-medium">{dateLabel}:</dt>
              <dd className="font-medium text-foreground text-right tabular-nums">
                {dateValue}
              </dd>
            </dl>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!canDownload || downloading}
              className="w-full min-h-[56px] rounded-xl border border-border bg-muted/30 hover:bg-muted/50 flex items-center justify-center gap-3 px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              <span className="rounded-lg border border-border bg-background p-2">
                <ArrowDownTrayIcon className="h-5 w-5 text-foreground" />
              </span>
              <span className="text-base font-semibold text-foreground">
                {downloading ? "Downloading…" : "Download offer letter"}
              </span>
            </button>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setIsRejectMode((prev) => !prev)}
                disabled={isPending}
                className={
                  isRejectMode
                    ? "h-12 rounded-xl border-[#f0caca] bg-[#f9e2e2] text-[#CE2922] hover:bg-[#f5d5d5]"
                    : "h-12 rounded-xl border-border bg-[#e9edf2] text-foreground hover:bg-[#dde4eb]"
                }
              >
                Reject offer
              </Button>
              <Button
                size="lg"
                onClick={handleAccept}
                disabled={isPending}
                className="h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-sm"
              >
                Accept and sign offer
              </Button>
            </div>

            {isRejectMode && (
              <div className="mt-6 space-y-3">
                <Label htmlFor="rejection-reason" className="block text-base font-semibold text-foreground">
                  Please provide a reason for rejecting this offer?
                </Label>
                <div className="relative">
                  <Textarea
                    id="rejection-reason"
                    placeholder="Enter reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    className="min-h-[92px] resize-none rounded-xl border-border bg-[#f9fafb] px-4 py-3.5 pb-8 focus:border-primary/35 focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10"
                    maxLength={200}
                  />
                  <p className="absolute right-3.5 bottom-2.5 text-[13px] text-muted-foreground pointer-events-none">
                    {rejectionReason.length}/200 characters
                  </p>
                </div>
              </div>
            )}

            <div
              className={`mt-6 flex gap-3 ${isRejectMode ? "flex-row flex-wrap items-center justify-between" : "flex-wrap items-center justify-center"}`}
            >
              <p
                className={`text-sm text-muted-foreground ${isRejectMode ? "flex-1 min-w-0 text-left" : "text-center flex-1 min-w-0"}`}
              >
                {isRejectMode ? (
                  <>
                    Please respond to this offer by
                    <br />
                    {expiresAt}.
                  </>
                ) : (
                  <>Please respond to this offer by {expiresAt}.</>
                )}
              </p>
              {isRejectMode && (
                <Button
                  size="sm"
                  onClick={handleReject}
                  disabled={isPending}
                  className="inline-flex h-9 min-h-[36px] items-center justify-center gap-2 rounded-xl border border-[#e3e8ee] bg-[#edf1f5] px-3.5 text-[15px] font-medium text-[#444] hover:bg-[#e6ebf0]"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  Confirm rejection
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
