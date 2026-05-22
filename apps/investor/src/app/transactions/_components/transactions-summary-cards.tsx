"use client";

import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { cn } from "@/lib/utils";
import type { TransactionsSummary } from "./transactions-mock-data";

interface TransactionsSummaryCardsProps {
  summary: TransactionsSummary;
  className?: string;
}

function SummaryCard({
  label,
  value,
  trendAmount,
  trendPercent,
}: {
  label: string;
  value: number;
  trendAmount: number;
  trendPercent: number;
}) {
  return (
    <div className="flex-1 rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{formatCurrency(value)}</p>
      <div className="mt-6 flex items-center gap-2 text-sm text-green-600">
        <ArrowUpRightIcon className="h-4 w-4" />
        <span>{trendAmount.toFixed(1)}</span>
        <span className="text-muted-foreground">+{trendPercent.toFixed(2)}% this week</span>
      </div>
    </div>
  );
}

export function TransactionsSummaryCards({ summary, className }: TransactionsSummaryCardsProps) {
  return (
    <div className={cn("grid flex-1 grid-cols-1 gap-4 md:grid-cols-3", className)}>
      <SummaryCard
        label="Total portfolio size"
        value={summary.totalPortfolioSize}
        trendAmount={summary.trendAmount}
        trendPercent={summary.trendPercent}
      />
      <SummaryCard
        label="Current total investment"
        value={summary.totalInvestment}
        trendAmount={summary.trendAmount}
        trendPercent={summary.trendPercent}
      />
      <SummaryCard
        label="Available balance"
        value={summary.availableBalance}
        trendAmount={summary.trendAmount}
        trendPercent={summary.trendPercent}
      />
    </div>
  );
}
