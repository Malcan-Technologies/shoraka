"use client";

import { ProductCatalogName } from "@cashsouk/ui";
import type { NoteListItem } from "@cashsouk/types";
import {
  marketplaceContractPurposeLabel,
  marketplaceNoteHeadline,
  toMarketplaceNote,
} from "@/marketplace/marketplace-note-model";

/** Purpose-first identity shared by portfolio cards and investment details. */
export function InvestmentNoteIdentity({ note }: { note: NoteListItem }) {
  const listing = toMarketplaceNote(note);
  const headline = marketplaceNoteHeadline(listing);
  const contractPurpose = marketplaceContractPurposeLabel(listing);
  const industry = note.issuerIndustry?.trim() || null;
  const showProduct = Boolean(
    note.productName?.trim() || note.productImageS3Key?.trim() || note.productImageUrl?.trim()
  );

  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-card-title leading-snug text-foreground" title={headline}>
        {headline}
      </p>
      {contractPurpose ? (
        <p className="text-ui leading-6 text-muted-foreground" title={contractPurpose}>
          {contractPurpose}
        </p>
      ) : null}
      {showProduct ? (
        <ProductCatalogName
          name={note.productName}
          imageS3Key={note.productImageS3Key}
          imageUrl={note.productImageUrl}
          size="xs"
        />
      ) : null}
      {industry ? <p className="text-meta leading-5 text-muted-foreground">{industry}</p> : null}
    </div>
  );
}
