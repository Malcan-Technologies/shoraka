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
  titleAsLink = true,
  leadSize = "md",
  className,
}: {
  note: MarketplaceNote;
  featuredMark?: ReactNode;
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

  const titleClassName = "line-clamp-2 text-card-title leading-snug text-foreground";

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <MarketplaceNoteLead note={note} size={leadSize} />
      <div className="min-w-0 space-y-1.5">
        {showBadges ? (
          <div className="flex flex-wrap items-center gap-2">
            {featuredMark}
            {showFunded ? <StatusBadge label="Funded" status="success" /> : null}
            {showFailed ? <StatusBadge label="Funding failed" status="rejected" /> : null}
          </div>
        ) : null}
        {titleAsLink ? (
          <Link
            href={`/investments/${note.id}`}
            className={cn(titleClassName, "hover:text-primary")}
            title={headline}
          >
            {headline}
          </Link>
        ) : (
          <p className={titleClassName} title={headline}>
            {headline}
          </p>
        )}
        {contractPurpose ? (
          <p
            className="line-clamp-2 text-ui leading-6 text-muted-foreground"
            title={contractPurpose}
          >
            {contractPurpose}
          </p>
        ) : null}
        {context ? (
          <p className="text-meta leading-5 text-muted-foreground" title={context}>
            {context}
          </p>
        ) : null}
      </div>
    </div>
  );
}
