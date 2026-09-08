/**
 * Slim signing-envelope payload for issuer application list/detail.
 * Omits S3 keys — clients download signed letters through dedicated blob routes.
 */

export const SIGNING_ENVELOPE_OFFER_SUMMARY_SELECT = {
  application_id: true,
  status: true,
  contract_id: true,
  invoice_id: true,
  documents: {
    select: {
      source: true,
      template_ref: true,
      signed_s3_key: true,
    },
  },
} as const;

export type SigningEnvelopeOfferSummaryRow = {
  application_id: string;
  status: string;
  contract_id: string | null;
  invoice_id: string | null;
  documents: Array<{
    source: string;
    template_ref: string | null;
    signed_s3_key: string | null;
  }>;
};

export type SigningEnvelopeOfferSummary = {
  status: string;
  contract_id: string | null;
  invoice_id: string | null;
  documents: Array<{
    source: string;
    template_ref: string | null;
    has_signed_pdf: boolean;
  }>;
};

export function toSigningEnvelopeOfferSummaries(
  rows: readonly SigningEnvelopeOfferSummaryRow[]
): SigningEnvelopeOfferSummary[] {
  return rows.map((row) => ({
    status: row.status,
    contract_id: row.contract_id,
    invoice_id: row.invoice_id,
    documents: row.documents.map((document) => ({
      source: document.source,
      template_ref: document.template_ref,
      has_signed_pdf: Boolean(document.signed_s3_key?.trim()),
    })),
  }));
}

export function groupSigningEnvelopeOfferSummariesByApplication(
  rows: readonly SigningEnvelopeOfferSummaryRow[]
): Map<string, SigningEnvelopeOfferSummary[]> {
  const grouped = new Map<string, SigningEnvelopeOfferSummary[]>();
  for (const row of rows) {
    const summaries = grouped.get(row.application_id) ?? [];
    summaries.push(...toSigningEnvelopeOfferSummaries([row]));
    grouped.set(row.application_id, summaries);
  }
  return grouped;
}
