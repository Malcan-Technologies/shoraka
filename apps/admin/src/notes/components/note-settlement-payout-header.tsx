import { cn } from "@/lib/utils";
import type { NoteSettlementPayoutHeaderModel } from "@/notes/utils/note-settlement-header";

export function NoteSettlementPayoutHeader({
  model,
  className,
}: {
  model: NoteSettlementPayoutHeaderModel;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-muted/50 p-4 md:p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-meta text-muted-foreground">{model.totalLabel}</p>
          <p className="mt-1 text-section-title tabular-nums tracking-tight text-foreground">
            {model.totalValue}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-meta text-muted-foreground">{model.returnLabel}</p>
          <p className="mt-1 text-section-title tabular-nums tracking-tight text-foreground">
            {model.returnValue}
          </p>
          {model.returnHint ? (
            <p className="mt-1 text-meta text-muted-foreground">{model.returnHint}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {model.rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <p className="text-meta text-muted-foreground">{row.label}</p>
            <p className="mt-0.5 text-ui font-semibold tabular-nums text-foreground">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
