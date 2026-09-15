import { FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY } from "@cashsouk/types";

export const JSG_SIGNING_DOCUMENT_KEY = "guarantor_agreement";
export const DOA_SIGNING_DOCUMENT_KEY = "deed_of_assignment";
export const FA_SIGNING_DOCUMENT_KEY = FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY;

export type NoteSigningDocumentLike = {
  id: string;
  name: string;
  template_ref: string | null;
  signed_s3_key: string | null;
  signed_file_sha256: string | null;
  status: string;
};

export type NoteSigningEnvelopeLike = {
  id: string;
  status: string;
  application_id: string;
  contract_id: string | null;
  invoice_id: string | null;
  completed_at: Date | string | null;
  documents: NoteSigningDocumentLike[];
};

export type NoteSigningTarget = {
  applicationId: string;
  contractId: string | null;
  invoiceId: string | null;
};

function completedAtMs(value: Date | string | null): number {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function hasSignedPdf(document: NoteSigningDocumentLike): boolean {
  return Boolean(document.signed_s3_key?.trim());
}

/** Exact offer target: invoice notes match the invoice envelope; facility notes match the contract envelope. */
export function envelopeMatchesNoteTarget(
  envelope: NoteSigningEnvelopeLike,
  target: NoteSigningTarget
): boolean {
  if (envelope.application_id !== target.applicationId) return false;
  if (target.invoiceId) return envelope.invoice_id === target.invoiceId;
  if (target.contractId) {
    return envelope.contract_id === target.contractId && envelope.invoice_id == null;
  }
  return false;
}

export function pickLatestMatchingCompletedEnvelope(
  envelopes: readonly NoteSigningEnvelopeLike[],
  target: NoteSigningTarget
): NoteSigningEnvelopeLike | null {
  const matching = envelopes.filter(
    (envelope) =>
      envelope.status === "COMPLETED" && envelopeMatchesNoteTarget(envelope, target)
  );
  matching.sort((a, b) => {
    const delta = completedAtMs(b.completed_at) - completedAtMs(a.completed_at);
    if (delta !== 0) return delta;
    return b.id.localeCompare(a.id);
  });
  return matching[0] ?? null;
}

export function pickSignedDocumentByTemplateRef(
  envelope: NoteSigningEnvelopeLike | null,
  templateRef: string
): NoteSigningDocumentLike | null {
  if (!envelope) return null;
  const documents = envelope.documents.filter((document) => document.template_ref === templateRef);
  return documents.find((document) => hasSignedPdf(document)) ?? documents[0] ?? null;
}

export function signedDocumentIsAvailable(document: NoteSigningDocumentLike | null): boolean {
  return Boolean(document && hasSignedPdf(document));
}
