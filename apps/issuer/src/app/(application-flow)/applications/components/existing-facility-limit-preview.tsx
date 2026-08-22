import {
  LEFT_ON_CONTRACT_HELPER,
  LEFT_ON_CONTRACT_LABEL,
  LEFT_TO_DRAW_HELPER,
  LEFT_TO_DRAW_LABEL,
  type DualLimitPreview,
} from "@cashsouk/types";
import { formatMoney } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

export function ExistingFacilityLimitPreview({
  preview,
  warning,
  hardError,
}: {
  preview: DualLimitPreview;
  warning: string | null;
  hardError: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <LimitCell
          label={LEFT_TO_DRAW_LABEL}
          helper={LEFT_TO_DRAW_HELPER}
          remaining={preview.leftToDraw}
          draftAmount={preview.financingAmount}
          draftLabel="This draft financing"
          exceeds={preview.exceedsFacility}
        />
        <LimitCell
          label={LEFT_ON_CONTRACT_LABEL}
          helper={LEFT_ON_CONTRACT_HELPER}
          remaining={preview.leftOnContract}
          draftAmount={preview.invoiceFace}
          draftLabel="This draft invoice face"
          exceeds={preview.exceedsLifetime}
        />
      </div>
      {hardError ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive bg-destructive/10 px-4 py-3 text-ui font-medium text-destructive"
        >
          {hardError}
        </p>
      ) : null}
      {warning && !hardError ? (
        <p
          role="status"
          className="rounded-xl border border-status-action-text/30 bg-status-action-bg px-4 py-3 text-ui font-medium text-status-action-text"
        >
          {warning}
        </p>
      ) : null}
    </div>
  );
}

function LimitCell({
  label,
  helper,
  remaining,
  draftAmount,
  draftLabel,
  exceeds,
}: {
  label: string;
  helper: string;
  remaining: number | null;
  draftAmount: number;
  draftLabel: string;
  exceeds: boolean;
}) {
  return (
    <div className="space-y-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-meta text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-base font-semibold tabular-nums text-foreground",
          exceeds && "text-status-action-text"
        )}
      >
        {remaining != null ? `RM ${formatMoney(remaining)}` : "—"}
      </p>
      <p className="text-ui leading-6 text-muted-foreground">{helper}</p>
      <p className="text-ui leading-6 text-muted-foreground">
        {draftLabel}:{" "}
        <span className={cn("font-medium tabular-nums", exceeds && "text-status-action-text")}>
          RM {formatMoney(draftAmount)}
        </span>
      </p>
    </div>
  );
}
