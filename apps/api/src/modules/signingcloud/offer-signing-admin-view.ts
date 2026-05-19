import { NoteStatus } from "@prisma/client";
import type { OfferSigningAdminView, OfferSigningSummary } from "@cashsouk/types";
import {
  mapActiveOfferSigningSummary,
  parseOfferSigningHistory,
  isSignedOfferSigningRecord,
} from "./types";

const CONTRACT_NOTE_STATUSES_BLOCKING_RESIGN: NoteStatus[] = [
  NoteStatus.PUBLISHED,
  NoteStatus.FUNDING,
  NoteStatus.ACTIVE,
  NoteStatus.REPAID,
  NoteStatus.ARREARS,
  NoteStatus.DEFAULTED,
];

export function buildOfferSigningAdminView(params: {
  offerSigning: unknown;
  offerSigningHistory: unknown;
  offerDetails: Record<string, unknown> | null;
  primaryApplicationId: string | null;
  canResign: boolean;
}): OfferSigningAdminView {
  const { offerSigning, offerSigningHistory, offerDetails, primaryApplicationId, canResign } =
    params;
  const activeSignedOffer = mapActiveOfferSigningSummary(offerSigning, offerDetails);
  const archivedRaw = parseOfferSigningHistory(offerSigningHistory);
  const archivedSignedOffers: OfferSigningSummary[] = archivedRaw.map((entry) => ({
    status: "archived",
    signerEmail: entry.signer_email ?? null,
    signedOfferLetterS3Key: entry.signed_offer_letter_s3_key,
    completedAt: entry.completed_at ?? null,
    offerVersion:
      typeof entry.offer_version === "number" && Number.isFinite(entry.offer_version)
        ? entry.offer_version
        : null,
    archivedAt: entry.archived_at,
  }));

  return {
    activeSignedOffer,
    archivedSignedOffers,
    canResign: canResign && isSignedOfferSigningRecord(offerSigning),
    primaryApplicationId,
  };
}

export function contractResignBlockedByNotes(
  notes: { status: string }[]
): boolean {
  return notes.some((n) =>
    CONTRACT_NOTE_STATUSES_BLOCKING_RESIGN.includes(n.status as NoteStatus)
  );
}

const NOTE_STATUSES_BLOCKING_INVOICE_RESIGN: NoteStatus[] = [
  NoteStatus.PUBLISHED,
  NoteStatus.FUNDING,
  NoteStatus.ACTIVE,
  NoteStatus.REPAID,
  NoteStatus.ARREARS,
  NoteStatus.DEFAULTED,
];

export function noteAllowsInvoiceResign(noteStatus: string): boolean {
  return !NOTE_STATUSES_BLOCKING_INVOICE_RESIGN.includes(noteStatus as NoteStatus);
}
