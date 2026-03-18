"use client";

import { formatCurrency } from "@cashsouk/config";

export interface ContractFacilitySummaryProps {
  /** Total approved facility (contract financing limit) */
  contractFacility: number;
  /** Remaining available facility after utilized and submitted */
  availableFacility: number;
  /** Utilized facility (total approved invoices financing amount) */
  utilizedFacility: number;
}

export function ContractFacilitySummary({
  contractFacility,
  availableFacility,
  utilizedFacility,
}: ContractFacilitySummaryProps) {
  const isOverdrawn = availableFacility < 0;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Contract Facility</p>
          <p className="text-[15px] leading-7 font-semibold tabular-nums">
            {formatCurrency(contractFacility)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Utilized Facility</p>
          <p className="text-[15px] leading-7 font-semibold tabular-nums">
            {formatCurrency(utilizedFacility)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Available Facility</p>
          <p
            className={`text-[15px] leading-7 font-semibold tabular-nums ${
              isOverdrawn ? "text-destructive" : ""
            }`}
          >
            {formatCurrency(availableFacility)}
          </p>
        </div>
      </div>
    </div>
  );
}
