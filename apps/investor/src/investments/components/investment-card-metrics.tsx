import { formatCurrency } from "@cashsouk/config";
import { InfoTooltip } from "@cashsouk/ui";
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import type { InvestmentCardPayoutResult } from "../investment-position-model";

export const LARGE_METRIC_CLASS = "text-3xl leading-none tracking-tight md:text-4xl";
export { investmentDateKpiValueClassName } from "./investment-date-kpi";

export function formatRiskScore(riskRating: string | null | undefined): string {
  const grade = riskRating?.trim().toUpperCase();
  return grade || "—";
}

export function InvestmentKpiBox({
  value,
  label,
  extra,
  tooltip,
  valueClassName,
}: {
  value: string;
  label: string;
  extra?: string;
  tooltip?: string | null;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-4 text-center sm:min-h-36 sm:px-4 sm:py-5">
      <p className={cn("font-semibold tabular-nums", LARGE_METRIC_CLASS, valueClassName)}>
        {value}
      </p>
      <p className="inline-flex items-center justify-center gap-1 text-ui text-muted-foreground">
        {label}
        {tooltip ? <InfoTooltip content={tooltip} iconClassName="h-3.5 w-3.5" /> : null}
      </p>
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
