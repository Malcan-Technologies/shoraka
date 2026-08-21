import {
  CONTRACT_ALLOCATION_LABEL,
  CREDIT_FACILITY_LABEL,
  LEFT_ON_CONTRACT_HELPER,
  LEFT_ON_CONTRACT_LABEL,
  LEFT_TO_DRAW_HELPER,
  LEFT_TO_DRAW_LABEL,
} from "@cashsouk/types";
import {
  clampMeterAriaNow,
  contractAllocationMeterLabel,
  creditFacilityMeterLabel,
  type FacilityDisplayMetrics,
} from "@/lib/facility-capacity-display";
import { EM_DASH, formatMoney } from "./utils";

function meterPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

function MeterBar({
  label,
  value,
  max,
  ariaLabel,
}: {
  label: string;
  value: number;
  max: number;
  ariaLabel: string;
}) {
  const percent = meterPercent(value, max);
  const valueMin = 0;
  const valueMax = Math.max(0, max);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-meta text-muted-foreground">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div
        role="meter"
        aria-label={ariaLabel}
        aria-valuemin={valueMin}
        aria-valuemax={valueMax}
        aria-valuenow={clampMeterAriaNow(value, valueMin, valueMax)}
        className="h-3 w-full overflow-hidden rounded-full border border-border bg-foreground/35 shadow-sm dark:bg-muted"
      >
        <div className="h-3 rounded-full bg-foreground" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function FacilityDualLimitSummaries({ metrics }: { metrics: FacilityDisplayMetrics }) {
  const approved = metrics.approved ?? 0;
  const utilized = metrics.utilized ?? 0;
  const reserved = metrics.pending ?? 0;
  const occupied = metrics.occupied ?? utilized + reserved;
  const available = metrics.available ?? (approved > 0 ? approved - occupied : null);
  const lifetimeCap = metrics.lifetimeCap ?? metrics.contractValue;
  const lifetimeUsed = metrics.lifetimeUsed ?? 0;
  const lifetimeRemaining =
    metrics.lifetimeRemaining ?? (lifetimeCap != null ? lifetimeCap - lifetimeUsed : null);
  const showCredit = approved > 0;
  const showLifetime = lifetimeCap != null && lifetimeCap > 0;

  if (!showCredit && !showLifetime) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {showCredit ? (
        <section
          className="space-y-3 rounded-xl border border-border bg-muted/30 p-4"
          aria-labelledby="credit-facility-heading"
        >
          <div>
            <h3 id="credit-facility-heading" className="text-base font-semibold text-foreground">
              {CREDIT_FACILITY_LABEL}
            </h3>
            <p className="mt-1 text-ui leading-6 text-muted-foreground">{LEFT_TO_DRAW_HELPER}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCell label={LEFT_TO_DRAW_LABEL} value={formatMoney(available)} />
            <MetricCell label="Reserved" value={reserved > 0 ? formatMoney(reserved) : EM_DASH} />
            <MetricCell label="Utilised" value={formatMoney(utilized)} />
            <MetricCell label="Approved" value={formatMoney(approved)} />
          </div>
          <MeterBar
            label="Reusable credit"
            value={occupied}
            max={approved}
            ariaLabel={creditFacilityMeterLabel({
              utilized,
              reserved,
              approved,
              available: available ?? 0,
            })}
          />
        </section>
      ) : null}
      {showLifetime ? (
        <section
          className="space-y-3 rounded-xl border border-border bg-muted/30 p-4"
          aria-labelledby="contract-allocation-heading"
        >
          <div>
            <h3
              id="contract-allocation-heading"
              className="text-base font-semibold text-foreground"
            >
              {CONTRACT_ALLOCATION_LABEL}
            </h3>
            <p className="mt-1 text-ui leading-6 text-muted-foreground">
              {LEFT_ON_CONTRACT_HELPER}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCell label={LEFT_ON_CONTRACT_LABEL} value={formatMoney(lifetimeRemaining)} />
            <MetricCell label="Used" value={formatMoney(lifetimeUsed)} />
            <MetricCell label="Contract value" value={formatMoney(lifetimeCap)} />
          </div>
          <MeterBar
            label="One-time contract allocation"
            value={lifetimeUsed}
            max={lifetimeCap}
            ariaLabel={contractAllocationMeterLabel({
              used: lifetimeUsed,
              remaining: lifetimeRemaining ?? 0,
              cap: lifetimeCap,
            })}
          />
        </section>
      ) : null}
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-meta text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
