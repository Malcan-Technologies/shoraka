"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@cashsouk/config";
import { OfferAcceptanceDeadlineConfirmRows } from "../offer-acceptance-deadline-confirm-rows";
import { REVIEW_EMPTY_LABEL } from "../review-section-styles";
import type { AcceptanceDeadlinePreview } from "@cashsouk/types";

export type ContractOfferConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractValue: number;
  requestedFacility: number;
  offeredFacility: number;
  facilityFeeRatePercent: number | null;
  totalFacilityFee: number;
  upfrontAmount: number;
  remainingForDrawdown: number;
  acceptanceDeadlinePreview: AcceptanceDeadlinePreview | null;
  facilityOfferBlockReason: string | null;
  canSend: boolean;
  isSendPending?: boolean;
  hasFeeErrors: boolean;
  onConfirm: () => void;
};

/** Confirm-and-send dialog extracted from ContractSection for reuse in the unified Send offer stage. */
export function ContractOfferConfirmDialog({
  open,
  onOpenChange,
  contractValue,
  requestedFacility,
  offeredFacility,
  facilityFeeRatePercent,
  totalFacilityFee,
  upfrontAmount,
  remainingForDrawdown,
  acceptanceDeadlinePreview,
  facilityOfferBlockReason,
  canSend,
  isSendPending,
  hasFeeErrors,
  onConfirm,
}: ContractOfferConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Facility Offer</DialogTitle>
          <DialogDescription>
            Review the offer details below before sending to the issuer.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Contract value</span>
            <span className="font-medium tabular-nums">
              {contractValue > 0 ? formatCurrency(contractValue) : REVIEW_EMPTY_LABEL}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Requested facility</span>
            <span className="font-medium tabular-nums">
              {requestedFacility > 0 ? formatCurrency(requestedFacility) : REVIEW_EMPTY_LABEL}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Offered facility</span>
            <span className="font-medium tabular-nums">{formatCurrency(offeredFacility)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Facility fee rate</span>
            <span className="font-medium tabular-nums">
              {facilityFeeRatePercent == null ? "—" : `${facilityFeeRatePercent}%`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total facility fee</span>
            <span className="font-medium tabular-nums">{formatCurrency(totalFacilityFee)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Upfront via payment gateway</span>
            <span className="font-medium tabular-nums">{formatCurrency(upfrontAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Remaining for drawdown collections</span>
            <span className="font-medium tabular-nums">{formatCurrency(remainingForDrawdown)}</span>
          </div>
          {acceptanceDeadlinePreview ? (
            <OfferAcceptanceDeadlineConfirmRows preview={acceptanceDeadlinePreview} />
          ) : null}
          {facilityOfferBlockReason ? (
            <p className="mt-2 text-sm text-destructive">{facilityOfferBlockReason}</p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!canSend || !!isSendPending || hasFeeErrors}
            className="rounded-xl"
          >
            {isSendPending ? "Sending..." : "Confirm & Send Offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
