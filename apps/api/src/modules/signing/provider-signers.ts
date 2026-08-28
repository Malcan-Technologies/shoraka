/**
 * Build the provider signer list for one envelope document.
 *
 * SigningCloud rejects a contract whose `signerinfo` array repeats an email (HTTP 404,
 * empty body), yet one person legitimately signs for several parties on the same
 * document — e.g. the same director is authorised signatory for an individual and a
 * corporate guarantor. Such assignments collapse into a single signer whose signset
 * carries every signature field they own.
 */
import { normalizeSigningEmail } from "@cashsouk/types";
import type { ProviderSigner } from "./provider/adapter";

export interface DocumentSignerRow {
  email: string;
  /** Signature-field placements for this assignment, in signing order. */
  signset?: unknown;
}

function readSignFields(signset: unknown): unknown[] {
  return Array.isArray(signset) ? signset : [];
}

export function buildDocumentProviderSigners(
  rows: readonly DocumentSignerRow[]
): ProviderSigner[] {
  const byEmail = new Map<string, { email: string; fields: unknown[] }>();
  for (const row of rows) {
    const key = normalizeSigningEmail(row.email);
    const signer = byEmail.get(key);
    if (signer) {
      signer.fields.push(...readSignFields(row.signset));
      continue;
    }
    byEmail.set(key, { email: row.email, fields: readSignFields(row.signset) });
  }
  return [...byEmail.values()].map(({ email, fields }) => ({
    email,
    // No fields means the provider adapter places its stacked default rectangle.
    signset: fields.length > 0 ? fields : undefined,
  }));
}
