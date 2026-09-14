"use client";

import * as React from "react";
import { toast } from "sonner";
import type { NoteDetail } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReasonConfirmDialog } from "@/components/reason-confirm-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { NoteLateChargeWaiverPanel } from "@/notes/components/note-late-charge-waiver-panel";
import { NoteServicingLettersList } from "@/notes/components/note-servicing-letters-list";
import { NoteServicingStatusSummary } from "@/notes/components/note-servicing-status-summary";
import {
  useGenerateArrearsLetter,
  useGenerateDefaultLetter,
  useMarkNoteDefault,
} from "../hooks/use-notes";
import {
  resolveLatePaymentActionGates,
  resolveLatePaymentTimeline,
} from "../utils/late-payment-workflow";

export function LateDefaultPanel({ note }: { note: NoteDetail }) {
  const { can } = usePermissions();
  const canManage = can("notes.default.manage");
  const canSettlement = can("notes.settlement.manage");
  const [reason, setReason] = React.useState("");
  const [markDefaultOpen, setMarkDefaultOpen] = React.useState(false);
  const arrearsLetter = useGenerateArrearsLetter();
  const defaultLetter = useGenerateDefaultLetter();
  const markDefault = useMarkNoteDefault();
  const timeline = resolveLatePaymentTimeline(note);
  const servicingOpen =
    note.fundingStatus === "FUNDED" && note.servicingStatus !== "NOT_STARTED";
  const latePaymentActionGates = resolveLatePaymentActionGates({
    timeline,
    servicingOpen,
    canDefaultPermission: canManage,
    servicingStatusArrears: note.servicingStatus === "ARREARS",
    defaultReason: reason,
    defaultMarkedAt: note.defaultMarkedAt,
  });
  const eligible = note.servicingStatus === "ARREARS";

  const handleLetter = async (kind: "arrears" | "default") => {
    try {
      await (kind === "arrears"
        ? arrearsLetter.mutateAsync(note.id)
        : defaultLetter.mutateAsync(note.id));
      toast.success(`${kind === "arrears" ? "Arrears" : "Default"} letter generated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate letter");
    }
  };

  const handleMarkDefault = async () => {
    if (!reason.trim()) {
      toast.error("Default reason is required");
      return;
    }
    try {
      await markDefault.mutateAsync({ id: note.id, reason });
      setReason("");
      setMarkDefaultOpen(false);
      toast.success("Note marked as default");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark default");
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">Late, Arrears, and Default</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {eligible ? (
          <div className="rounded-xl border border-status-action-text/30 bg-status-action-bg/40 p-4">
            <p className="text-sm font-medium">Eligible for default</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This note is in arrears. Confirm default only after reviewing the file.
            </p>
            <Button
              className="mt-3"
              variant="destructive"
              disabled={!latePaymentActionGates.canMarkDefault || markDefault.isPending}
              onClick={() => setMarkDefaultOpen(true)}
            >
              Mark Default
            </Button>
          </div>
        ) : null}
        <NoteServicingStatusSummary note={note} timeline={timeline} />
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <div className="text-muted-foreground">Grace period</div>
            <div className="font-medium">{note.gracePeriodDays} days</div>
          </div>
          <div>
            <div className="text-muted-foreground">Arrears threshold</div>
            <div className="font-medium">{note.arrearsThresholdDays} days after grace</div>
          </div>
          <div>
            <div className="text-muted-foreground">Late caps</div>
            <div className="font-medium">
              Ta&apos;widh {note.tawidhRateCapPercent}%, Gharamah {note.gharamahRateCapPercent}%
            </div>
          </div>
        </div>
        <NoteLateChargeWaiverPanel note={note} canManage={canSettlement} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => handleLetter("arrears")}
            disabled={arrearsLetter.isPending || !latePaymentActionGates.canGenerateArrearsLetter}
            title={
              !canManage
                ? "You do not have permission to perform this action."
                : !latePaymentActionGates.canGenerateArrearsLetter
                  ? (latePaymentActionGates.arrearsHelperText ?? undefined)
                  : undefined
            }
          >
            Generate Arrears Letter
          </Button>
          <Button
            variant="outline"
            onClick={() => handleLetter("default")}
            disabled={defaultLetter.isPending || !latePaymentActionGates.canGenerateDefaultLetter}
            title={
              !canManage
                ? "You do not have permission to perform this action."
                : !latePaymentActionGates.canGenerateDefaultLetter
                  ? (latePaymentActionGates.defaultHelperText ?? undefined)
                  : undefined
            }
          >
            Generate Default Letter
          </Button>
        </div>
        {latePaymentActionGates.arrearsHelperText ? (
          <p className="text-xs text-muted-foreground">{latePaymentActionGates.arrearsHelperText}</p>
        ) : null}
        {latePaymentActionGates.defaultHelperText ? (
          <p className="text-xs text-muted-foreground">{latePaymentActionGates.defaultHelperText}</p>
        ) : null}
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="mb-3 text-sm font-medium">Servicing letters</div>
          <NoteServicingLettersList note={note} canManage={canManage} />
        </div>
        <ReasonConfirmDialog
          open={markDefaultOpen}
          onOpenChange={(next) => {
            if (!next && !markDefault.isPending) setMarkDefaultOpen(false);
          }}
          title="Mark this note as default?"
          description="This records a default, emails the issuer a default notice, and cannot be undone from this screen."
          confirmLabel="Mark Default"
          destructive
          pending={markDefault.isPending}
          reason={reason}
          onReasonChange={setReason}
          reasonId="late-default-mark-reason"
          onConfirm={() => void handleMarkDefault()}
        />
      </CardContent>
    </Card>
  );
}
