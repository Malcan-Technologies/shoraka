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

  const handleReject = async () => {
    if (!context) return;
    try {
      if (context.type === "contract") {
        await rejectContract.mutateAsync({
          applicationId: context.applicationId,
          reason: rejectionReason || undefined,
        });
      } else {
        await rejectInvoice.mutateAsync({
          applicationId: context.applicationId,
          invoiceId: context.invoiceId,
          reason: rejectionReason || undefined,
        });
      }
      toast.success("Offer rejected");
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  if (!context) return null;

  const od = context.type === "contract" ? context.contract?.offer_details : context.invoice?.offer_details;
  const details = od as Record<string, unknown> | null | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Review offer</DialogTitle>
          <DialogDescription>
            Review the offer details below before accepting or rejecting.
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
              <dt className="text-muted-foreground">Offered amount</dt>
              <dd className="font-medium text-foreground">
                {formatMoneyDisplay(details.offered_amount as number)}
              </dd>
              {(details.offered_ratio_percent != null || details.offered_profit_rate_percent != null) && (
                <>
                  {details.offered_ratio_percent != null && (
                    <>
                      <dt className="text-muted-foreground">Offered ratio</dt>
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
          <div className="space-y-2">
            <Label htmlFor="rejection-reason" className="text-sm text-muted-foreground">
              Please provide a reason for rejecting this offer.
            </Label>
            <Textarea
              id="rejection-reason"
              placeholder="e.g. Enter reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
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
            disabled={isPending}
          >
            {isPending ? "Processing..." : "Reject"}
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
