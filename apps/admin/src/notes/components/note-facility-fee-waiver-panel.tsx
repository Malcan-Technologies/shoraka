"use client";

import * as React from "react";
import { toast } from "sonner";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import type { NoteDetail } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { ReasonConfirmDialog } from "@/components/reason-confirm-dialog";
import { useWaiveNoteFacilityFeeCollection } from "@/notes/hooks/use-notes";
import {
  canWaiveNoteFacilityFeeCollection,
  noteFacilityFeeCollectionWaiverLabel,
} from "@/notes/utils/note-facility-fee-actions";

export function NoteFacilityFeeWaiverPanel({
  note,
  canManage,
}: {
  note: NoteDetail;
  canManage: boolean;
}) {
  const waive = useWaiveNoteFacilityFeeCollection();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const waivedLabel = noteFacilityFeeCollectionWaiverLabel(note);
  const canWaive = canWaiveNoteFacilityFeeCollection(note);

  if (!canWaive && !waivedLabel) return null;

  const confirm = async () => {
    if (reason.trim().length === 0) return;
    try {
      await waive.mutateAsync({ id: note.id, reason: reason.trim() });
      toast.success("Facility fee collection waived for this note");
      setOpen(false);
      setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to waive facility fee collection");
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BanknotesIcon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-ui font-medium">Facility fee collection</p>
          {waivedLabel ? (
            <p className="text-sm text-muted-foreground">{waivedLabel} Visible to the issuer.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Waive this note&apos;s frozen facility-fee collection before funding closes. The issuer
              can see the waived state.
            </p>
          )}
        </div>
      </div>
      {canWaive ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          disabled={!canManage || waive.isPending}
          onClick={() => {
            setReason("");
            setOpen(true);
          }}
        >
          Waive facility fee collection
        </Button>
      ) : null}
      <ReasonConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !waive.isPending) setOpen(false);
        }}
        title="Waive this note's facility fee collection?"
        description="This note will not collect the frozen facility fee at disbursement. The remainder stays on the facility. A reason is required and is visible to the issuer."
        confirmLabel="Waive collection"
        pending={waive.isPending}
        reason={reason}
        onReasonChange={setReason}
        reasonId="note-facility-fee-collection-waiver-reason"
        onConfirm={() => void confirm()}
      />
    </div>
  );
}
