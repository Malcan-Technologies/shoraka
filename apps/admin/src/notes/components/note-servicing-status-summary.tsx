import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import type { NoteDetail } from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { LATE_PAYMENT_WORKFLOW_BADGE, type LatePaymentTimeline } from "@/notes/utils/late-payment-workflow";
import { latePaymentPhaseTone, workflowToneToStatusToken } from "@/notes/utils/workflow-status-tokens";

export function NoteServicingStatusSummary({
  note,
  timeline,
}: {
  note: NoteDetail;
  timeline: LatePaymentTimeline;
}) {
  const badge = LATE_PAYMENT_WORKFLOW_BADGE[timeline.phase];
  const dpd = note.daysPastDue ?? timeline.daysPastMaturity;
  return (
    <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-ui md:grid-cols-4">
      <div>
        <p className="text-muted-foreground">Servicing status</p>
        <StatusBadge
          label={badge.label}
          status={workflowToneToStatusToken(latePaymentPhaseTone(timeline.phase))}
          className="mt-1"
        />
      </div>
      <div>
        <p className="text-muted-foreground">Days past due</p>
        <p className="mt-1 font-medium tabular-nums">{dpd}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Indicative Ta&apos;widh</p>
        <p className="mt-1 font-medium tabular-nums">
          {formatCurrency(note.indicativeTawidhAmount ?? 0)}
        </p>
        {note.indicativeAsOf ? (
          <p className="text-meta text-muted-foreground">
            as of {format(new Date(note.indicativeAsOf), "dd MMM yyyy")}
          </p>
        ) : null}
      </div>
      <div>
        <p className="text-muted-foreground">Indicative Gharamah</p>
        <p className="mt-1 font-medium tabular-nums">
          {formatCurrency(note.indicativeGharamahAmount ?? 0)}
        </p>
      </div>
    </div>
  );
}
