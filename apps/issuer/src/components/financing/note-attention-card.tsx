"use client";

import { NoteStatusBadge } from "@cashsouk/ui";
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

export function NoteAttentionCard({ note }: { note: NoteListItem }) {
  const action = getNoteAttentionAction(note);
  const inArrears = isIssuerNoteInArrears(note);
  const noteRef = displayCell(note.noteReference);

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
      ctaHref={`/financing/notes/${note.id}`}
      ctaLabel={action.label}
    />
  );
}
