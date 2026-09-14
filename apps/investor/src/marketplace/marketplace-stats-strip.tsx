"use client";

import { formatCurrency } from "@cashsouk/config";
import { PlusIcon } from "@heroicons/react/24/outline";
import { StatStrip } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { marketplaceBookSummary, type MarketplaceNote } from "./marketplace-note-model";

export function MarketplaceStatsStrip({
  availableBalance,
  notes,
  isBalanceLoading,
  isBookLoading,
  onDeposit,
}: {
  availableBalance: number;
  notes: readonly MarketplaceNote[];
  isBalanceLoading: boolean;
  isBookLoading: boolean;
  onDeposit: () => void;
}) {
  const book = marketplaceBookSummary(notes);

  return (
    <StatStrip
      cells={[
        {
          label: "Available to invest",
          value: formatCurrency(availableBalance),
          loading: isBalanceLoading,
        },
        {
          label: "Open notes",
          value: `${book.openCount} ${book.openCount === 1 ? "note" : "notes"}`,
          loading: isBookLoading,
        },
        {
          label: "Rate range",
          value: book.rateRange,
          accent: true,
          loading: isBookLoading,
        },
        {
          label: "Tenure range",
          value: book.tenureRange,
          loading: isBookLoading,
        },
      ]}
      action={
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-xl border-primary text-primary hover:bg-primary/5 sm:w-auto"
          onClick={onDeposit}
        >
          <PlusIcon className="h-4 w-4" />
          Deposit
        </Button>
      }
    />
  );
}
