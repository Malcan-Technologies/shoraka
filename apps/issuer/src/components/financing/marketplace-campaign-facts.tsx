"use client";

import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import { cn } from "@/lib/utils";
import {
  buildIssuerMarketplaceCampaign,
  issuerFailedFundingHelp,
  issuerFundingProgressSummary,
  type IssuerMarketplaceNoteInput,
} from "./marketplace-campaign";
import { InvestorCommitmentLine, formatMoney } from "./utils";

function MarketplaceFundingThresholdBar({
  fundingPercent,
  minimumPercent,
}: {
  fundingPercent: number;
  minimumPercent: number;
}) {
  const progress = Math.max(0, Math.min(100, fundingPercent));
  const showThreshold = minimumPercent > 0 && minimumPercent < 100;

  return (
    <div className="space-y-2">
      <div className="relative pt-4">
        {showThreshold ? (
          <span
            className="pointer-events-none absolute top-0 -translate-x-1/2 text-meta leading-none text-muted-foreground"
            style={{ left: `${minimumPercent}%` }}
          >
            {minimumPercent}%
          </span>
        ) : null}
        <div
          className="relative h-1.5"
          role="img"
          aria-label={`${Math.round(progress)}% funded. ${minimumPercent}% minimum required for funding to succeed.`}
        >
          <div className="absolute inset-0 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          {showThreshold ? (
            <span
              aria-hidden
              className="absolute top-1/2 z-10 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
              style={{ left: `${minimumPercent}%` }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

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

  return (
    <div className={cn("space-y-2", className)}>
      {variant === "detail" && campaign.raising ? (
        <MarketplaceFundingThresholdBar
          fundingPercent={campaign.fundingPercent}
          minimumPercent={campaign.minimumPercent}
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
