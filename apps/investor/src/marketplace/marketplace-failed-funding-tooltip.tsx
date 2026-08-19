"use client";

import { InfoTooltip } from "@cashsouk/ui";
import { marketplaceFailedFundingHelp } from "./marketplace-note-model";

export function MarketplaceFailedFundingTooltip({
  minimumPercent,
}: {
  minimumPercent: number;
}) {
  return (
    <InfoTooltip
      content={marketplaceFailedFundingHelp(minimumPercent)}
      iconClassName="h-3.5 w-3.5 shrink-0"
    />
  );
}
