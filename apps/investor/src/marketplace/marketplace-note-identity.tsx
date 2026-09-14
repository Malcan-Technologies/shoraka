"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ProductCatalogImage, StatusBadge } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { MarketplaceIndustryIcon } from "./marketplace-industry-icon";
import {
  marketplaceContractPurposeLabel,
  marketplaceNoteContextLine,
  marketplaceNoteHeadline,
  type MarketplaceNote,
} from "./marketplace-note-model";

function MarketplaceNoteLead({
  note,
  size,
}: {
  note: MarketplaceNote;
  size: "md" | "lg";
}) {
  return (
    <ProductCatalogImage
      imageS3Key={note.productImageS3Key}
      imageUrl={note.productImageUrl}
      alt={note.productName ?? "Product"}
      size={size}
      fallback={<MarketplaceIndustryIcon industry={note.industry} size={size} />}
    />
  );
}

export function MarketplaceNoteIdentity({
  note,
  featuredMark,
  trailing,
  titleAsLink = true,
  leadSize = "md",
  className,
}: {
  note: MarketplaceNote;
  featuredMark?: ReactNode;
  trailing?: ReactNode;
  titleAsLink?: boolean;
  leadSize?: "md" | "lg";
  className?: string;
}) {
  const headline = marketplaceNoteHeadline(note);
  const contractPurpose = marketplaceContractPurposeLabel(note);
  const context = marketplaceNoteContextLine(note);
  const showFunded = note.listingKind === "funded";
  const showFailed = note.listingKind === "failed";
  const showBadges = Boolean(featuredMark) || showFunded || showFailed;

  const titleClassName = "min-w-0 text-card-title leading-snug text-foreground";

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      {showBadges ? (
        <div className="flex flex-wrap items-center gap-2">
          {featuredMark}
          {showFunded ? <StatusBadge label="Funded" status="success" /> : null}
          {showFailed ? <StatusBadge label="Funding failed" status="rejected" /> : null}
        </div>
      ) : null}
      <div className="flex min-w-0 items-start gap-3">
        <MarketplaceNoteLead note={note} size={leadSize} />
        {titleAsLink ? (
          <Link
            href={`/investments/${note.id}`}
            className={cn(titleClassName, "flex-1 hover:text-primary")}
            title={headline}
          >
            {headline}
          </Link>
        ) : (
          <p className={cn(titleClassName, "flex-1")} title={headline}>
            {headline}
          </p>
        )}
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {contractPurpose ? (
        <p className="text-ui leading-6 text-muted-foreground" title={contractPurpose}>
          {contractPurpose}
        </p>
      ) : null}
      {context ? (
        <p className="text-meta leading-5 text-muted-foreground" title={context}>
          {context}
        </p>
      ) : null}
    </div>
  );
}
