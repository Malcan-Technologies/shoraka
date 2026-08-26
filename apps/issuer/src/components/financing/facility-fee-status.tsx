"use client";

import type { ReactNode } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { formatMoneyDisplay } from "@cashsouk/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { FacilityFeeBalance } from "@cashsouk/types";

const EM_DASH = "—";

export function FacilityDisabledBanner({ reason }: { reason: string | null }) {
  return (
    <aside
      role="status"
      className="rounded-md border border-status-action-text/30 bg-status-action-bg px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <InformationCircleIcon
          className="mt-0.5 h-5 w-5 shrink-0 text-status-action-text"
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <p className="text-ui font-medium text-status-action-text">This facility is disabled</p>
          <p className="text-ui leading-6 text-status-action-text">
            It cannot be selected for a new drawdown.
            {reason ? ` ${reason}` : ""}
          </p>
        </div>
      </div>
    </aside>
  );
}

export function FacilityFeeBalanceSummary({
  balance,
  compact = false,
  stacked = false,
  owedLabelExtra,
}: {
  balance: FacilityFeeBalance | null;
  compact?: boolean;
  /** Vertical rows for narrow sidebars (offer review). */
  stacked?: boolean;
  owedLabelExtra?: ReactNode;
}) {
  if (!balance) return null;
  const owed = formatMoneyDisplay(balance.totalOwed, EM_DASH);
  const charged = formatMoneyDisplay(balance.paid, EM_DASH);
  const waived = balance.waived
    ? formatMoneyDisplay(balance.waivedAmount, "Waived")
    : EM_DASH;
  const remaining = formatMoneyDisplay(balance.remaining, EM_DASH);

  if (stacked) {
    return (
      <div className="space-y-1">
        <dt className="inline-flex items-center gap-1 text-muted-foreground">
          Facility fee collected
          {owedLabelExtra}
        </dt>
        <dd className="font-medium tabular-nums">
          {charged} / {owed} cap
          {balance.waived ? (
            <span className="mt-0.5 block text-meta font-normal text-muted-foreground">
              Waived {waived}
            </span>
          ) : null}
        </dd>
      </div>
    );
  }

  if (compact) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Facility fee:{" "}
        <span className="font-medium tabular-nums text-foreground">
          {charged} charged / {owed} owed
        </span>
        {balance.waived ? (
          <span className="ml-1 tabular-nums">· waived {waived}</span>
        ) : (
          <span className="ml-1 tabular-nums">· {remaining} remaining</span>
        )}
        <span className="ml-1 inline-flex items-center align-middle">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InformationCircleIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px] whitespace-normal break-words bg-popover px-2 py-1.5 text-popover-foreground shadow-md">
                The facility fee is owed in full when the facility offer is accepted. CashSouk
                collects it at its discretion.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-ui sm:grid-cols-4">
        <div className="space-y-0.5">
          <dt className="text-muted-foreground">Owed</dt>
          <dd className="font-medium tabular-nums text-foreground">{owed}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-muted-foreground">Charged</dt>
          <dd className="font-medium tabular-nums text-foreground">{charged}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-muted-foreground">Waived</dt>
          <dd className="font-medium tabular-nums text-foreground">{waived}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-muted-foreground">Remaining</dt>
          <dd className="font-medium tabular-nums text-foreground">{remaining}</dd>
        </div>
      </dl>
      <p className="flex items-start gap-1.5 text-sm leading-6 text-muted-foreground">
        <InformationCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          The facility fee is owed in full when the facility offer is accepted. CashSouk collects
          it at its discretion.
        </span>
      </p>
    </div>
  );
}
