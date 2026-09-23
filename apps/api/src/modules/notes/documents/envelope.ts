import {
  FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY,
  resolveCompletedSigningEnvelopeWhere,
} from "@cashsouk/types";

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
  contractId: string | null;
  invoiceId: string | null;
  invoiceContractId?: string | null;
};

function completedAtMs(value: Date | string | null): number {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function hasSignedPdf(document: NoteSigningDocumentLike): boolean {
  return Boolean(document.signed_s3_key?.trim());
}

/**
 * Invoice-only notes match the invoice envelope. Contract-linked invoices reuse
 * the facility package (invoice_id null), even when the envelope lives on the
 * originating facility application.
 */
export function envelopeMatchesNoteTarget(
  envelope: NoteSigningEnvelopeLike,
  target: NoteSigningTarget
): boolean {
  const envelopeWhere = resolveCompletedSigningEnvelopeWhere({
    sourceInvoiceId: target.invoiceId,
    sourceContractId: target.contractId,
    invoiceContractId: target.invoiceContractId,
  });
  if (!envelopeWhere) return false;
  if ("invoice_id" in envelopeWhere) {
    return envelope.invoice_id === envelopeWhere.invoice_id;
  }
  return envelope.contract_id === envelopeWhere.contract_id && envelope.invoice_id == null;
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
