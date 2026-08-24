"use client";

import { formatCurrency } from "@cashsouk/config";
import { StatusBadge } from "@cashsouk/ui";
import {
  CONTRACT_ALLOCATION_HEADING,
  CONTRACT_ALLOCATION_HELPER,
  CREDIT_FACILITY_HEADING,
  CREDIT_FACILITY_HELPER,
  OVER_LIMIT_LABEL,
  REMAINING_ALLOCATION_LABEL,
  REMAINING_CREDIT_LABEL,
  RESERVED_LABEL,
  clampMeterAriaNow,
  contractAllocationMeterLabel,
  creditFacilityMeterLabel,
} from "@/lib/facility-capacity-display";
import { getContractUtilizationProgressClass } from "@/contracts/utils/contract-facility-metrics";
import { cn } from "@/lib/utils";

export interface ContractFacilitySummaryProps {
  /** Approved credit ceiling */
  contractFacility: number;
  /** Remaining credit after live utilized and reserved draws */
  availableFacility: number;
  /** Live utilized facility */
  utilizedFacility: number;
  /** Reserved financing on submitted / amendment / offer-sent invoices */
  pendingFacility?: number;
  lifetimeCap?: number;
  lifetimeUsed?: number;
  lifetimeRemaining?: number;
}

function meterPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

function MeterBar({
  value,
  max,
  ariaLabel,
  overLimit,
}: {
  value: number;
  max: number;
  ariaLabel: string;
  overLimit: boolean;
}) {
  const percent = meterPercent(value, max);
  const valueMin = 0;
  const valueMax = Math.max(0, max);
  return (
    <div
      role="meter"
      aria-label={ariaLabel}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      aria-valuenow={clampMeterAriaNow(value, valueMin, valueMax)}
      className={cn(
        "h-3 w-full overflow-hidden rounded-full bg-muted",
        getContractUtilizationProgressClass(max > 0 ? (value / max) * 100 : null, max > 0)
      )}
    >
      <div
        className="h-3 rounded-full bg-current"
        style={{ width: `${overLimit ? 100 : percent}%` }}
      />
    </div>
  );
}

function MetricCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-meta text-muted-foreground">{label}</p>
      <p className="mt-1 text-ui font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="text-meta text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ContractFacilitySummary({
  contractFacility,
  availableFacility,
  utilizedFacility,
  pendingFacility = 0,
  lifetimeCap = 0,
  lifetimeUsed = 0,
  lifetimeRemaining,
}: ContractFacilitySummaryProps) {
  const reserved = pendingFacility;
  const occupied = utilizedFacility + reserved;
  const remainingCredit = availableFacility;
  const remainingAllocation =
    lifetimeRemaining ?? (lifetimeCap > 0 ? lifetimeCap - lifetimeUsed : 0);
  const creditOverLimit =
    remainingCredit < 0 || (contractFacility > 0 && occupied > contractFacility);
  const allocationOverLimit = lifetimeCap > 0 && remainingAllocation < 0;
  const showCredit = contractFacility > 0;
  const showAllocation = lifetimeCap > 0;

  if (!showCredit && !showAllocation) return null;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {showCredit ? (
        <section
          className="space-y-3 rounded-xl border border-border bg-muted/20 px-4 py-3"
          aria-labelledby="admin-credit-facility-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3
                id="admin-credit-facility-heading"
                className="text-ui font-semibold text-foreground"
              >
                {CREDIT_FACILITY_HEADING}
              </h3>
              <p className="mt-1 text-meta text-muted-foreground">{CREDIT_FACILITY_HELPER}</p>
            </div>
            {creditOverLimit ? <StatusBadge label={OVER_LIMIT_LABEL} status="rejected" /> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCell label={REMAINING_CREDIT_LABEL} value={formatCurrency(remainingCredit)} />
            <MetricCell
              label={RESERVED_LABEL}
              value={formatCurrency(reserved)}
              hint={reserved > 0 ? "Submitted, amendment, and offer requests" : undefined}
            />
            <MetricCell label="Utilized" value={formatCurrency(utilizedFacility)} />
            <MetricCell label="Approved" value={formatCurrency(contractFacility)} />
          </div>
          <MeterBar
            value={occupied}
            max={contractFacility}
            overLimit={creditOverLimit}
            ariaLabel={creditFacilityMeterLabel({
              utilized: utilizedFacility,
              reserved,
              approved: contractFacility,
              available: remainingCredit,
            })}
          />
        </section>
      ) : null}
      {showAllocation ? (
        <section
          className="space-y-3 rounded-xl border border-border bg-muted/20 px-4 py-3"
          aria-labelledby="admin-contract-allocation-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3
                id="admin-contract-allocation-heading"
                className="text-ui font-semibold text-foreground"
              >
                {CONTRACT_ALLOCATION_HEADING}
              </h3>
              <p className="mt-1 text-meta text-muted-foreground">{CONTRACT_ALLOCATION_HELPER}</p>
            </div>
            {allocationOverLimit ? (
              <StatusBadge label={OVER_LIMIT_LABEL} status="rejected" />
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCell
              label={REMAINING_ALLOCATION_LABEL}
              value={formatCurrency(remainingAllocation)}
            />
            <MetricCell label="Used" value={formatCurrency(lifetimeUsed)} />
            <MetricCell label="Contract value" value={formatCurrency(lifetimeCap)} />
          </div>
          <MeterBar
            value={lifetimeUsed}
            max={lifetimeCap}
            overLimit={allocationOverLimit}
            ariaLabel={contractAllocationMeterLabel({
              used: lifetimeUsed,
              remaining: remainingAllocation,
              cap: lifetimeCap,
            })}
          />
        </section>
      ) : null}
    </div>
  );
}
