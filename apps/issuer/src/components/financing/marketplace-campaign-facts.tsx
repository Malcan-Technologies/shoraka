"use client";

import { FundingProgress } from "@cashsouk/ui";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import { cn } from "@/lib/utils";
import {
  buildIssuerMarketplaceCampaign,
  issuerFailedFundingHelp,
  issuerFundingProgressSummary,
  type IssuerMarketplaceNoteInput,
} from "./marketplace-campaign";
import { InvestorCommitmentLine, formatMoney } from "./utils";

export function MarketplaceCampaignFacts({
  note,
  variant = "card",
  className,
}: {
  note: IssuerMarketplaceNoteInput;
  variant?: "card" | "detail";
  className?: string;
}) {
  const campaign = buildIssuerMarketplaceCampaign(note);
  if (variant === "card" && !campaign.raising) return null;

  const remainingLabel = formatMoney(campaign.remainingCapacity);
  const summary = issuerFundingProgressSummary(campaign, remainingLabel);
  const help = issuerFailedFundingHelp(campaign.minimumPercent);
  const showBar = campaign.raising || variant === "detail";

  return (
    <div className={cn("space-y-2", className)}>
      {showBar ? (
        <FundingProgress
          percent={campaign.fundingPercent}
          thresholdPercent={campaign.minimumPercent}
          aria-label={`${Math.round(campaign.fundingPercent)}% funded. ${campaign.minimumPercent}% minimum required for funding to succeed.`}
        />
      ) : null}
      {campaign.raising ? (
        <p className="inline-flex items-start gap-1.5 text-ui text-muted-foreground">
          <span>{summary}</span>
          <InfoTooltip content={help} iconClassName="h-3.5 w-3.5 shrink-0" />
        </p>
      ) : null}
      <InvestorCommitmentLine
        fundedAmount={campaign.fundedAmount}
        investorCount={campaign.investorCount}
      />
    </div>
  );
}
