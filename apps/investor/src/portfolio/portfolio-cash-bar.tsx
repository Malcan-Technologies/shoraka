"use client";

import { formatCurrency, useOrganization } from "@cashsouk/config";
import { formatInvestorReturnRatePercent } from "@cashsouk/types";
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvestorInvestments } from "@/investments/hooks/use-marketplace-notes";
import {
  averageRealizedAnnualReturnRatePercent,
  portfolioPayoutResult,
} from "@/investments/investment-position-model";
import { cn } from "@/lib/utils";

function investedBreakdown(confirmed: number, reserved: number): string | null {
  const parts: string[] = [];
  if (confirmed > 0.005) parts.push(`${formatCurrency(confirmed)} confirmed`);
  if (reserved > 0.005) parts.push(`${formatCurrency(reserved)} reserved`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function CashMetric({
  label,
  value,
  detail,
  isLoading,
}: {
  label: string;
  value: number;
  detail?: string | null;
  isLoading: boolean;
}) {
  return (
    <div>
      <p className="text-ui text-muted-foreground">{label}</p>
      {isLoading ? (
        <Skeleton className="mt-1 h-8 w-36" />
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {formatCurrency(value)}
          </p>
          {detail ? <p className="mt-1 text-ui text-muted-foreground">{detail}</p> : null}
        </>
      )}
    </div>
  );
}

function PnlMetric({
  isLoading,
  kind,
  amount,
  averageReturnRate,
}: {
  isLoading: boolean;
  kind: "profit" | "loss" | "flat";
  amount: number;
  averageReturnRate: number | null;
}) {
  const toneClassName =
    kind === "profit"
      ? "text-status-success-text"
      : kind === "loss"
        ? "text-status-rejected-text"
        : "text-foreground";

  return (
    <div>
      <p className="text-ui text-muted-foreground">Profit & loss</p>
      {isLoading ? (
        <Skeleton className="mt-1 h-8 w-36" />
      ) : (
        <p
          className={cn(
            "mt-1 flex items-center gap-1.5 text-2xl font-semibold tabular-nums tracking-tight",
            toneClassName
          )}
        >
          {kind === "profit" ? (
            <ArrowTrendingUpIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
          ) : null}
          {kind === "loss" ? (
            <ArrowTrendingDownIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
          ) : null}
          {formatCurrency(amount)}
        </p>
      )}
      {!isLoading && averageReturnRate != null ? (
        <p className="mt-1 text-ui text-muted-foreground">
          {formatInvestorReturnRatePercent(averageReturnRate)} p.a. average
        </p>
      ) : null}
    </div>
  );
}

export function PortfolioCashBar({
  availableBalance,
  totalInvestment,
  confirmedInvestment,
  reservedInvestment,
  isLoading,
  onDeposit,
  onWithdraw,
}: {
  availableBalance: number;
  totalInvestment: number;
  confirmedInvestment: number;
  reservedInvestment: number;
  isLoading: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const { activeOrganization } = useOrganization();
  const investmentsQuery = useInvestorInvestments(activeOrganization?.id);
  const notes = investmentsQuery.data?.notes ?? [];
  const pnl = portfolioPayoutResult(notes);
  const averageReturnRate = averageRealizedAnnualReturnRatePercent(notes);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="grid min-w-[min(100%,32rem)] flex-1 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3 xl:gap-10">
        <CashMetric label="Cash balance" value={availableBalance} isLoading={isLoading} />
        <CashMetric
          label="Invested"
          value={totalInvestment}
          detail={investedBreakdown(confirmedInvestment, reservedInvestment)}
          isLoading={isLoading}
        />
        <PnlMetric
          isLoading={isLoading || investmentsQuery.isLoading}
          kind={pnl.kind}
          amount={pnl.amount}
          averageReturnRate={averageReturnRate}
        />
      </div>
      <div className="grid w-full min-w-[min(100%,20rem)] grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:shrink-0">
        <Button type="button" variant="action" className="h-11 w-full rounded-xl" onClick={onDeposit}>
          <PlusIcon className="h-4 w-4" />
          Deposit
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-xl border-primary text-primary hover:bg-primary/5"
          onClick={onWithdraw}
        >
          <MinusIcon className="h-4 w-4" />
          Withdraw
        </Button>
      </div>
    </div>
  );
}
