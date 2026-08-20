import { formatCurrency } from "@cashsouk/config";
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import type { InvestmentCardPayoutResult, InvestmentMaturityTone } from "../investment-position-model";

export const LARGE_METRIC_CLASS = "text-3xl leading-none tracking-tight md:text-4xl";

export const MATURITY_VALUE_CLASS: Record<InvestmentMaturityTone, string> = {
  soon: cn(LARGE_METRIC_CLASS, "text-foreground"),
  today: cn(LARGE_METRIC_CLASS, "text-foreground"),
  overdue: cn(LARGE_METRIC_CLASS, "text-status-rejected-text"),
  upcoming: cn(LARGE_METRIC_CLASS, "text-foreground"),
  settled: "text-xl leading-none tracking-tight text-foreground md:text-2xl",
  unknown: "text-xl leading-none tracking-tight text-muted-foreground md:text-2xl",
};

export function formatRiskScore(riskRating: string | null | undefined): string {
  const grade = riskRating?.trim().toUpperCase();
  return grade || "—";
}

export function InvestmentKpiBox({
  value,
  label,
  extra,
  valueClassName,
}: {
  value: string;
  label: string;
  extra?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-4 text-center sm:min-h-36 sm:px-4 sm:py-5">
      <p className={cn("font-semibold tabular-nums", LARGE_METRIC_CLASS, valueClassName)}>
        {value}
      </p>
      <p className="text-ui text-muted-foreground">{label}</p>
      {extra ? <p className="text-ui text-muted-foreground">{extra}</p> : null}
    </div>
  );
}

export function InvestmentPayoutResultLine({ result }: { result: InvestmentCardPayoutResult }) {
  const isProfit = result.kind === "profit";
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-ui font-medium tabular-nums",
        isProfit ? "text-status-success-text" : "text-status-rejected-text"
      )}
    >
      {isProfit ? (
        <ArrowTrendingUpIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <ArrowTrendingDownIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {isProfit ? "Profit" : "Loss"} {formatCurrency(result.amount)}
    </p>
  );
}
