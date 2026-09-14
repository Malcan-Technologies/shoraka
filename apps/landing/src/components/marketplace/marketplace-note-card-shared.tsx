import type { ReactNode } from "react";
import Link from "next/link";
import { BriefcaseIcon } from "@heroicons/react/24/outline";
import {
  formatCompactMarketplaceAmountPair,
  formatInvestorReturnRatePercent,
  marketplaceAmountTitle,
  marketplaceCardDaysLeftLabel,
  marketplaceCardRateLabel,
  marketplaceCardTenureLabel,
  marketplaceContractPurposeLabel,
  marketplaceInvestorSummary,
  marketplaceNoteContextLine,
  marketplaceNoteHeadline,
  type MarketplaceNote,
} from "@cashsouk/types";
import { Button, FundingProgress, InfoTooltip, cn } from "@cashsouk/ui";
import { PUBLIC_MARKETPLACE_SIGN_UP_HREF } from "@/lib/public-marketplace";
import { ViewProspectusButton } from "../view-prospectus-button";

export function MarketplaceProductLead({
  note,
  size = "md",
}: {
  note: MarketplaceNote;
  size?: "md" | "lg";
}) {
  const src = note.productImageUrl?.trim() || null;
  const sizeClass = size === "lg" ? "size-14" : "size-11";

  if (src) {
    return (
      <img
        src={src}
        alt={note.productName ?? "Product"}
        className={cn("shrink-0 object-contain", sizeClass)}
      />
    );
  }

  return (
    <BriefcaseIcon className={cn("shrink-0 text-muted-foreground", sizeClass)} aria-hidden />
  );
}

export function MarketplaceNoteHeadlineBlock({
  note,
  trailing,
}: {
  note: MarketplaceNote;
  trailing?: ReactNode;
}) {
  const contractLine = marketplaceContractPurposeLabel(note);
  const context = marketplaceNoteContextLine(note);

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 items-start gap-3">
        <MarketplaceProductLead note={note} />
        <h3 className="min-w-0 flex-1 text-card-title font-semibold tracking-tight text-foreground">
          {marketplaceNoteHeadline(note)}
        </h3>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {contractLine ? (
        <p className="text-ui leading-6 text-muted-foreground">{contractLine}</p>
      ) : null}
      {context ? <p className="text-meta leading-5 text-muted-foreground">{context}</p> : null}
    </div>
  );
}

export function MarketplaceNoteRateTenure({
  note,
  size,
  rateHint,
}: {
  note: MarketplaceNote;
  size: "featured" | "listing";
  rateHint?: ReactNode;
}) {
  const valueClass = cn(
    "font-bold tabular-nums leading-none tracking-tight",
    size === "featured" ? "text-3xl" : "text-2xl"
  );

  return (
    <div className="grid grid-cols-2 items-start gap-x-4 gap-y-1 border-t border-border pt-4">
      <div className="flex min-h-5 items-center gap-1 text-meta font-semibold uppercase tracking-wider text-muted-foreground">
        {marketplaceCardRateLabel(note)}
        {rateHint}
      </div>
      <div className="flex min-h-5 items-center gap-1 text-meta font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{marketplaceCardTenureLabel(note)}</span>
        {note.timing.tooltip ? (
          <InfoTooltip content={note.timing.tooltip} iconClassName="h-3.5 w-3.5" />
        ) : null}
      </div>
      <div className={cn(valueClass, "text-primary")}>
        {formatInvestorReturnRatePercent(note.annualReturn)}
      </div>
      <div className={cn(valueClass, "text-foreground")}>{note.timing.compactValue}</div>
    </div>
  );
}

export function MarketplaceNoteFundingRow({
  note,
  fillClassName,
  trackClassName,
  extraMeta,
}: {
  note: MarketplaceNote;
  fillClassName?: string;
  trackClassName?: string;
  extraMeta?: ReactNode;
}) {
  return (
    <div>
      <FundingProgress
        percent={note.fundingPercent}
        thresholdPercent={note.minimumFundingPercent}
        fillClassName={fillClassName}
        trackClassName={trackClassName}
        aria-label={`${note.fundingPercent}% funded. ${note.minimumFundingPercent}% minimum required for funding to succeed.`}
      />
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-meta tabular-nums text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          {note.fundingPercent}% funded
          {extraMeta}
        </span>
        <span title={marketplaceAmountTitle(note)}>
          {formatCompactMarketplaceAmountPair(note.fundedAmount, note.goalAmount)}
        </span>
        <span>{marketplaceCardDaysLeftLabel(note)}</span>
      </div>
      <p className="mt-2 text-ui text-muted-foreground">{marketplaceInvestorSummary(note)}</p>
    </div>
  );
}

export function MarketplaceNoteInvestActions({
  note,
  className,
}: {
  note: MarketplaceNote;
  className?: string;
}) {
  return (
    <div className={cn("mt-auto flex flex-col gap-2 pt-5", className)}>
      <Button asChild className="h-10 w-full rounded-xl">
        <Link href={PUBLIC_MARKETPLACE_SIGN_UP_HREF}>Invest now</Link>
      </Button>
      <ViewProspectusButton noteId={note.id} />
    </div>
  );
}
