"use client";

import * as React from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { formatMytDateTime, malaysiaDateTimeLocalToIso, type NoteDetail } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { validateExtendCampaignInput } from "@/notes/utils/extend-campaign";

export function NoteExtendCampaignDialog({
  note,
  open,
  onOpenChange,
  pending = false,
  onConfirm,
}: {
  note: NoteDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  onConfirm: (input: { closesAt: string; reason: string }) => Promise<void>;
}) {
  const [closesAtLocal, setClosesAtLocal] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const currentCloseLabel = formatMytDateTime(note.listing?.closesAt ?? null) ?? "Not set";

  React.useEffect(() => {
    if (!open) return;
    setClosesAtLocal("");
    setReason("");
    setError(null);
  }, [open, note.id]);

  const submit = async () => {
    const validationError = validateExtendCampaignInput({
      closesAtLocal,
      reason,
      currentClosesAt: note.listing?.closesAt ?? null,
      maturityDate: note.maturityDate,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    const closesAt = malaysiaDateTimeLocalToIso(closesAtLocal);
    if (!closesAt) {
      setError("Enter a valid Malaysia date and time.");
      return;
    }
    setError(null);
    await onConfirm({ closesAt, reason: reason.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Extend campaign?</DialogTitle>
          <DialogDescription>
            Current close: {currentCloseLabel} (Malaysia time). The marketplace countdown updates
            immediately, a new Prospectus is issued with the new Closing Date, and investors who
            already committed keep the Prospectus they acknowledged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="extend-campaign-closes-at">New closing date (Malaysia time)</Label>
            <Input
              id="extend-campaign-closes-at"
              type="datetime-local"
              value={closesAtLocal}
              onChange={(event) => setClosesAtLocal(event.target.value)}
              disabled={pending}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="extend-campaign-reason">Reason</Label>
            <Textarea
              id="extend-campaign-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              disabled={pending}
              required
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl gap-2"
            disabled={pending || reason.trim().length === 0 || closesAtLocal.length === 0}
            onClick={() => void submit()}
          >
            {pending ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
            {pending ? "Extending..." : "Extend campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
