"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ISSUER_OFFER_DECLINE_REASONS,
  OTHER_ISSUER_DECLINE_REASON_VALUE,
  resolveIssuerOfferDeclineReason,
} from "@/lib/issuer-offer-decline-reasons";
import {
  useAcceptContractOffer,
  useRejectContractOffer,
  useAcceptInvoiceOffer,
  useRejectInvoiceOffer,
} from "@/hooks/use-applications";
import { toast } from "sonner";
import { formatMoneyDisplay } from "@cashsouk/ui";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type OfferContext =
  | { type: "contract"; applicationId: string; contract: { offer_details?: Record<string, unknown> | null } }
  | { type: "invoice"; applicationId: string; invoiceId: string; invoice: { offer_details?: Record<string, unknown> | null } };

interface ReviewOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: OfferContext | null;
}

export function ReviewOfferModal({ open, onOpenChange, context }: ReviewOfferModalProps) {
  const acceptContract = useAcceptContractOffer();
  const rejectContract = useRejectContractOffer();
  const acceptInvoice = useAcceptInvoiceOffer();
  const rejectInvoice = useRejectInvoiceOffer();
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [selectedDeclineReason, setSelectedDeclineReason] = React.useState("");
  const isOtherDeclineReason = selectedDeclineReason === OTHER_ISSUER_DECLINE_REASON_VALUE;

  const isPending =
    acceptContract.isPending ||
    rejectContract.isPending ||
    acceptInvoice.isPending ||
    rejectInvoice.isPending;

  const handleAccept = async () => {
    if (!context) return;
    try {
      if (context.type === "contract") {
        await acceptContract.mutateAsync(context.applicationId);
      } else {
        await acceptInvoice.mutateAsync({
          applicationId: context.applicationId,
          invoiceId: context.invoiceId,
        });
      }
      toast.success("Offer accepted");
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const resolvedDeclineReason = resolveIssuerOfferDeclineReason(selectedDeclineReason, rejectionReason);

  const handleReject = async () => {
    if (!context || !resolvedDeclineReason) return;
    try {
      if (context.type === "contract") {
        await rejectContract.mutateAsync({
          applicationId: context.applicationId,
          reason: resolvedDeclineReason,
        });
      } else {
        await rejectInvoice.mutateAsync({
          applicationId: context.applicationId,
          invoiceId: context.invoiceId,
          reason: resolvedDeclineReason,
        });
      }
      toast.success("Offer declined");
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDialogOpenChange = (next: boolean) => {
    if (!next) {
      setRejectionReason("");
      setSelectedDeclineReason("");
    }
    onOpenChange(next);
  };

  const declineDisabled =
    isPending ||
    !selectedDeclineReason ||
    (isOtherDeclineReason && rejectionReason.trim() === "");

  if (!context) return null;

  const od = context.type === "contract" ? context.contract?.offer_details : context.invoice?.offer_details;
  const details = od as Record<string, unknown> | null | undefined;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Review offer</DialogTitle>
          <DialogDescription>
            Review the offer details below before accepting or declining.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {context.type === "contract" && details && (
            <dl className="grid grid-cols-[1fr_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Requested facility</dt>
              <dd className="font-medium text-foreground">
                {formatMoneyDisplay(details.requested_facility as number)}
              </dd>
              <dt className="text-muted-foreground">Offered facility</dt>
              <dd className="font-medium text-foreground">
                {formatMoneyDisplay(details.offered_facility as number)}
              </dd>
              <dt className="text-muted-foreground">Expires</dt>
              <dd className="font-medium text-foreground">
                {formatDate(details.expires_at as string)}
              </dd>
            </dl>
          )}
          {context.type === "invoice" && details && (
            <dl className="grid grid-cols-[1fr_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Requested amount</dt>
              <dd className="font-medium text-foreground">
                {formatMoneyDisplay(details.requested_amount as number)}
              </dd>
              <dt className="text-muted-foreground">Financing Amount</dt>
              <dd className="font-medium text-foreground">
                {formatMoneyDisplay(details.offered_amount as number)}
              </dd>
              {(details.offered_ratio_percent != null || details.offered_profit_rate_percent != null) && (
                <>
                  {details.offered_ratio_percent != null && (
                    <>
                      <dt className="text-muted-foreground">Financing Ratio</dt>
                      <dd className="font-medium text-foreground">
                        {(details.offered_ratio_percent as number)}%
                      </dd>
                    </>
                  )}
                  {details.offered_profit_rate_percent != null && (
                    <>
                      <dt className="text-muted-foreground">Profit rate</dt>
                      <dd className="font-medium text-foreground">
                        {(details.offered_profit_rate_percent as number)}%
                      </dd>
                    </>
                  )}
                </>
              )}
              <dt className="text-muted-foreground">Expires</dt>
              <dd className="font-medium text-foreground">
                {formatDate(details.expires_at as string)}
              </dd>
            </dl>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="decline-primary-reason" className="text-sm font-medium">
                Reason (required)
              </Label>
              <Select
                value={selectedDeclineReason}
                onValueChange={(value) => {
                  setSelectedDeclineReason(value);
                  if (value !== OTHER_ISSUER_DECLINE_REASON_VALUE) {
                    setRejectionReason("");
                  }
                }}
                disabled={isPending}
              >
                <SelectTrigger id="decline-primary-reason" className="rounded-xl">
                  <SelectValue placeholder="Select a primary reason" />
                </SelectTrigger>
                <SelectContent>
                  {ISSUER_OFFER_DECLINE_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER_ISSUER_DECLINE_REASON_VALUE}>
                    Other (manual reason)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejection-reason" className="text-sm text-muted-foreground">
                {isOtherDeclineReason
                  ? "Additional context (required)"
                  : "Additional context (optional)"}
              </Label>
              <Textarea
                id="rejection-reason"
                placeholder={
                  isOtherDeclineReason
                    ? "Enter the primary reason and any details."
                    : "Add any extra details (optional)."
                }
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="resize-none rounded-xl"
                maxLength={2000}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleReject}
            disabled={declineDisabled}
          >
            {isPending ? "Processing..." : "Decline"}
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            disabled={isPending}
          >
            {isPending ? "Processing..." : "Accept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
