"use client";

import * as React from "react";
import { toast } from "sonner";
import { ScaleIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import type { NoteDetail } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReasonConfirmDialog } from "@/components/reason-confirm-dialog";
import { useWaiveNoteLateCharge } from "@/notes/hooks/use-notes";

export function NoteLateChargeWaiverPanel({
  note,
  canManage,
}: {
  note: NoteDetail;
  canManage: boolean;
}) {
  const waive = useWaiveNoteLateCharge();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [tawidhAmount, setTawidhAmount] = React.useState("");
  const [gharamahAmount, setGharamahAmount] = React.useState("");
  const waivers = note.lateChargeWaivers ?? [];
  const hasAmount = Number(tawidhAmount) > 0 || Number(gharamahAmount) > 0;

  const confirm = async () => {
    if (reason.trim().length === 0 || !hasAmount) return;
    try {
      await waive.mutateAsync({
        id: note.id,
        tawidhAmount: tawidhAmount.trim() ? Number(tawidhAmount) : undefined,
        gharamahAmount: gharamahAmount.trim() ? Number(gharamahAmount) : undefined,
        reason: reason.trim(),
      });
      toast.success("Late charge waiver recorded");
      setOpen(false);
      setReason("");
      setTawidhAmount("");
      setGharamahAmount("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to waive late charges");
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ScaleIcon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-ui font-medium">Ta&apos;widh / Gharamah waiver</p>
          <p className="text-ui text-muted-foreground">
            Reduce the remaining cap before settlement, or leftover excess after posting. The
            reason is visible to the issuer.
          </p>
        </div>
      </div>
      {waivers.length > 0 ? (
        <ul className="space-y-2 text-ui">
          {waivers.map((waiver) => (
            <li key={waiver.id} className="rounded-xl border bg-muted/20 px-3 py-2">
              <p>
                Waived Ta&apos;widh {formatCurrency(waiver.tawidhWaivedAmount)} · Gharamah{" "}
                {formatCurrency(waiver.gharamahWaivedAmount)}
              </p>
              <p className="text-meta text-muted-foreground">{waiver.reason}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="late-charge-waiver-tawidh">Ta&apos;widh to waive</Label>
          <Input
            id="late-charge-waiver-tawidh"
            inputMode="decimal"
            value={tawidhAmount}
            onChange={(event) => setTawidhAmount(event.target.value)}
            disabled={!canManage || waive.isPending}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="late-charge-waiver-gharamah">Gharamah to waive</Label>
          <Input
            id="late-charge-waiver-gharamah"
            inputMode="decimal"
            value={gharamahAmount}
            onChange={(event) => setGharamahAmount(event.target.value)}
            disabled={!canManage || waive.isPending}
            placeholder="0.00"
          />
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl"
        disabled={!canManage || waive.isPending || !hasAmount}
        onClick={() => {
          setReason("");
          setOpen(true);
        }}
      >
        Waive late charges
      </Button>
      <ReasonConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !waive.isPending) setOpen(false);
        }}
        title="Waive late charges?"
        description="This reduces remaining Ta'widh or Gharamah. The reason is shown to the issuer."
        confirmLabel="Waive"
        pending={waive.isPending}
        reason={reason}
        onReasonChange={setReason}
        reasonId="late-charge-waiver-reason"
        onConfirm={() => void confirm()}
      />
    </div>
  );
}
