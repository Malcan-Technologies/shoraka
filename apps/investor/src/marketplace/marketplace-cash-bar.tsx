"use client";

import { formatCurrency } from "@cashsouk/config";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function MarketplaceCashBar({
  availableBalance,
  openListingCount,
  isLoading,
  onDeposit,
}: {
  availableBalance: number;
  openListingCount: number;
  isLoading: boolean;
  onDeposit: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-10">
        <div>
          <p className="text-ui text-muted-foreground">Available to invest</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-8 w-36" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {formatCurrency(availableBalance)}
            </p>
          )}
        </div>
        <div>
          <p className="text-ui text-muted-foreground">Open for funding</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-8 w-24" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {openListingCount} {openListingCount === 1 ? "note" : "notes"}
            </p>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-xl border-primary text-primary hover:bg-primary/5"
        onClick={onDeposit}
      >
        <PlusIcon className="h-4 w-4" />
        Deposit
      </Button>
    </div>
  );
}
