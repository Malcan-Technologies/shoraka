import { cn } from "@/lib/utils";

const EM = "\u2014";

/** Large circular financing-ratio mark — sized to match the hero FinancingDonut. */
export function FinancingPercentMark({
  percent,
  centerLabel = "Financed",
  className,
}: {
  percent: number | null | undefined;
  centerLabel?: string;
  className?: string;
}) {
  const rate =
    percent != null && Number.isFinite(percent)
      ? Math.max(0, Math.min(100, percent))
      : null;

  return (
    <div
      className={cn(
        "flex h-[8.5rem] w-[8.5rem] shrink-0 flex-col items-center justify-center rounded-full border-[5px] border-primary/35 bg-primary/5 sm:h-[10rem] sm:w-[10rem]",
        className
      )}
      aria-label={rate != null ? `Financing ${Math.round(rate)} percent` : "Financing ratio unavailable"}
    >
      <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
        {rate != null ? `${Math.round(rate)}%` : EM}
      </span>
      <span className="mt-1 text-[11px] font-normal leading-4 text-muted-foreground">
        {centerLabel}
      </span>
    </div>
  );
}
