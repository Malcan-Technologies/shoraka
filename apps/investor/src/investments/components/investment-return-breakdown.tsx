"use client";

import type { ReactNode } from "react";
import { formatCurrency } from "@cashsouk/config";
import {
  type NoteListItem,
} from "@cashsouk/types";
import { InfoTooltip } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

const SERVICE_FEE_HELP =
  "CashSouk deducts a service fee from contractual profit only. This fee is not deducted from your principal.";
const TAWIDH_HELP =
  "Ta'widh is late-payment compensation. It is separate from contractual profit and is not subject to the service fee.";

type BreakdownRowProps = {
  label: ReactNode;
  value: string;
  className?: string;
  valueClassName?: string;
};

function BreakdownRow({ label, value, className, valueClassName }: BreakdownRowProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 text-sm", className)}>
      <div className="text-muted-foreground">{label}</div>
      <div className={cn("shrink-0 font-medium tabular-nums text-foreground", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

type InvestmentReturnBreakdownCardProps = {
  note: NoteListItem;
  className?: string;
};

export function InvestmentReturnBreakdownCard({ note, className }: InvestmentReturnBreakdownCardProps) {
  const summary = note.investorRepaymentSummary;
  if (!summary) return null;

  const settlementEvents = summary.receivedSettlementEvents ?? [];
  const hasSettlement =
    summary.receivedPayoutAmount > 0.005 ||
    summary.receivedProfitGrossAmount > 0.005 ||
    summary.receivedProfitNetAmount > 0.005 ||
    summary.receivedTawidhCompensationAmount > 0.005 ||
    settlementEvents.length > 0;

  if (!hasSettlement) return null;

  const principalReturned =
    settlementEvents.length > 0
      ? settlementEvents.reduce((sum, event) => sum + event.principal, 0)
      : Math.max(
          0,
          summary.receivedPayoutAmount -
            summary.receivedProfitNetAmount -
            summary.receivedTawidhCompensationAmount
        );

  return (
    <div className={cn("space-y-5 rounded-3xl border border-border bg-card p-4 md:p-6", className)}>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">Settlement breakdown</h3>
        <p className="text-sm text-muted-foreground">
          This shows the actual values credited after settlement, including principal returned,
          service fee deducted from profit, and any ta&apos;widh compensation received.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Realized values</p>
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3">
          <BreakdownRow label="Principal returned" value={formatCurrency(principalReturned)} />
          {summary.receivedProfitGrossAmount > 0.005 ? (
            <BreakdownRow
              label="Gross profit (before fee)"
              value={formatCurrency(summary.receivedProfitGrossAmount)}
            />
          ) : null}
          {summary.receivedServiceFeeAmount > 0.005 ? (
            <BreakdownRow
              label={
                <span className="inline-flex items-center gap-1">
                  Service fee deducted
                  <InfoTooltip content={SERVICE_FEE_HELP} iconClassName="h-3.5 w-3.5" />
                </span>
              }
              value={`-${formatCurrency(summary.receivedServiceFeeAmount)}`}
              valueClassName="text-destructive"
            />
          ) : null}
          <BreakdownRow
            label="Net profit received"
            value={formatCurrency(summary.receivedProfitNetAmount)}
          />
          {summary.receivedTawidhCompensationAmount > 0.005 ? (
            <BreakdownRow
              label={
                <span className="inline-flex items-center gap-1">
                  Ta&apos;widh compensation
                  <InfoTooltip content={TAWIDH_HELP} iconClassName="h-3.5 w-3.5" />
                </span>
              }
              value={formatCurrency(summary.receivedTawidhCompensationAmount)}
            />
          ) : null}
          <BreakdownRow
            label="Total received"
            value={formatCurrency(summary.receivedPayoutAmount)}
            valueClassName="font-semibold"
          />
        </div>
      </div>
    </div>
  );
}

export function MarketplaceReturnRateTooltip() {
  return (
    <InfoTooltip
      content="Advertised return reflects the gross contractual profit rate before any service fee is deducted at repayment."
      iconClassName="h-3.5 w-3.5"
    />
  );
}
