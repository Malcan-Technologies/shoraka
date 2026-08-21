"use client";

import { NoteStatusBadge, ProductCatalogName } from "@cashsouk/ui";
import type { NoteListItem } from "@cashsouk/types";
import { isIssuerNoteInArrears } from "@/lib/issuer-financing-actionable";
import {
  FINANCING_ARREARS_SURFACE,
  FINANCING_ATTENTION_SURFACE,
  displayCell,
  formatMoney,
} from "./utils";
import { FinancingAttentionCardLayout } from "./financing-attention-card-layout";
import { getNoteAttentionAction } from "./note-attention-card-model";
import { FacilityTiedLink } from "./facility-tied-link";
import { resolveIssuerFacilityLink } from "./facility-tied";

export function NoteAttentionCard({ note }: { note: NoteListItem }) {
  const action = getNoteAttentionAction(note);
  const inArrears = isIssuerNoteInArrears(note);
  const noteRef = displayCell(note.noteReference);
  const facilityLink = resolveIssuerFacilityLink({
    contractId: note.sourceContractId,
    displayReference: note.sourceContractDisplayReference,
  });

  return (
    <FinancingAttentionCardLayout
      surfaceClassName={inArrears ? FINANCING_ARREARS_SURFACE : FINANCING_ATTENTION_SURFACE}
      kind="invoice"
      badge={<NoteStatusBadge note={note} />}
      headline={action.headline}
      customer={displayCell(note.paymasterName ?? note.title)}
      amount={formatMoney(note.fundedAmount || note.targetAmount)}
      meta={noteRef !== "—" ? noteRef : displayCell(note.title)}
      detail={`${Math.round(Math.max(0, Math.min(100, note.fundingPercent)))}% funded`}
      hint={action.hint}
      product={
        note.productName?.trim() || note.productCategory?.trim() ? (
          <ProductCatalogName
            name={note.productName}
            category={note.productCategory}
            imageS3Key={note.productImageS3Key}
          />
        ) : null
      }
      related={
        facilityLink ? (
          <FacilityTiedLink
            contractId={note.sourceContractId}
            displayReference={note.sourceContractDisplayReference}
          />
        ) : null
      }
      ctaHref={`/financing/notes/${note.id}`}
      ctaLabel={action.label}
    />
  );
}
