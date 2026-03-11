"use client";

/**
 * Modal for reviewing contract or invoice offers before signing.
 * Shared by both offer types so the flow stays consistent.
 * Placeholder UI; real design will be added later.
 */

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useContract } from "@/hooks/use-contracts";

type ReviewOfferModalProps = {
  type: "contract" | "invoice";
  record: any;
  contractId?: string;
  onClose: () => void;
};

/** Only mounted when Review Offer is clicked. Renders once, no isOpen toggle to avoid flash. */
export function ReviewOfferModal({
  type,
  record,
  contractId,
  onClose,
}: ReviewOfferModalProps) {
  const router = useRouter();

  // For contract, fetch the record when we have contractId.
  const { data: contractRecord, isLoading: isLoadingContract } = useContract(
    type === "contract" && contractId ? contractId : ""
  );

  const displayRecord = type === "contract" ? contractRecord : record;
  const isLoading = type === "contract" && isLoadingContract;
  const offerDetails = displayRecord?.offer_details;

  const title =
    type === "contract" ? "Contract Financing Offer" : "Invoice Financing Offer";

  const handleReject = () => {
    console.log("Reject offer clicked", displayRecord);
  };

  const handleAccept = () => {
    console.log("Accept and sign offer clicked", displayRecord);
    onClose();
    if (type === "contract" && contractId) {
      router.push(`/applications/sign/contract/${contractId}`);
    } else if (type === "invoice" && displayRecord?.id) {
      router.push(`/applications/sign/invoice/${displayRecord.id}`);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading offer...</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Record ID: {displayRecord?.id ?? "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                Offer amount: {offerDetails?.offered_amount ?? "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                Expiry: {offerDetails?.expires_at ?? "—"}
              </p>
              <p className="text-sm text-muted-foreground pt-2">
                Offer summary will appear here
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={handleReject}>
            Reject Offer
          </Button>
          <Button onClick={handleAccept}>Accept and Sign Offer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
