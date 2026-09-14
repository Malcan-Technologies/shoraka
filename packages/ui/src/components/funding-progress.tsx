import { cn } from "../lib/utils";

export const DEFAULT_FUNDING_THRESHOLD_PERCENT = 80;

export function resolveFundingThresholdPercent(value?: number | null): number | null {
  const resolved = value == null ? DEFAULT_FUNDING_THRESHOLD_PERCENT : value;
  if (!Number.isFinite(resolved) || resolved <= 0 || resolved >= 100) return null;
  return resolved;
}

export function FundingProgress({
  percent,
  thresholdPercent = DEFAULT_FUNDING_THRESHOLD_PERCENT,
  fillClassName,
  trackClassName,
  className,
  "aria-label": ariaLabel,
}: {
  percent: number;
  thresholdPercent?: number | null;
  fillClassName?: string;
  trackClassName?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  const threshold = resolveFundingThresholdPercent(thresholdPercent);
  const label =
    ariaLabel ??
    (threshold != null
      ? `${pct}% funded. ${threshold}% minimum required for funding to succeed.`
      : "Funding progress");

  return (
    <div className={cn("space-y-2", className)}>
      {threshold != null ? (
        <div className="relative pt-4">
          <span
            className="pointer-events-none absolute top-0 -translate-x-1/2 text-meta leading-none text-muted-foreground"
            style={{ left: `${threshold}%` }}
          >
            {threshold}%
          </span>
          <div
            className="relative h-1.5"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label}
          >
            <div className={cn("absolute inset-0 overflow-hidden rounded-full bg-muted", trackClassName)}>
              <div
                className={cn("h-full rounded-full bg-primary", fillClassName)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span
              aria-hidden="true"
              className="absolute top-1/2 z-10 h-3 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/40"
              style={{ left: `${threshold}%` }}
            />
          </div>
        </div>
      ) : (
        <div
          className={cn("h-1.5 overflow-hidden rounded-full bg-muted", trackClassName)}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div
            className={cn("h-full rounded-full bg-primary", fillClassName)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
