"use client";

import { formatCurrency } from "@cashsouk/config";

export interface ContractFacilitySummaryProps {
  /** Total approved facility (contract financing limit) */
  contractFacility: number;
  /** Remaining available facility after live utilized draws */
  availableFacility: number;
  /** Live utilized facility (outstanding funded / reserved approved draws) */
  utilizedFacility: number;
  /** Submitted and offer-sent invoices; does not occupy the line */
  pendingFacility?: number;
}

export function ContractFacilitySummary({
  contractFacility,
  availableFacility,
  utilizedFacility,
  pendingFacility = 0,
}: ContractFacilitySummaryProps) {
  const isOverdrawn = availableFacility < 0;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Approved</p>
          <p className="text-[15px] leading-7 font-semibold tabular-nums">
            {formatCurrency(contractFacility)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Utilized (live)</p>
          <p className="text-[15px] leading-7 font-semibold tabular-nums">
            {formatCurrency(utilizedFacility)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Pending</p>
          <p className="text-[15px] leading-7 font-semibold tabular-nums">
            {formatCurrency(pendingFacility)}
          </p>
          <p className="text-meta text-muted-foreground">Not occupying the line</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Available</p>
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
