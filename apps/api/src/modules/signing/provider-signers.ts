/**
 * Build the provider signer list for one envelope document.
 *
 * SigningCloud rejects a contract whose `signerinfo` array repeats an email (HTTP 404,
 * empty body), yet one person legitimately signs for several parties on the same
 * document — e.g. the same director is authorised signatory for an individual and a
 * corporate guarantor. Such assignments collapse into a single signer whose signset
 * carries every signature field they own.
 *
 * Manual and automatic identities must stay distinct even if an email collides.
 * Automatic rows still need at least one `fieldtype: "sign"` box — SigningCloud
 * rejects an empty signset (`Missing signature attribute`).
 */
import { normalizeSigningEmail } from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import type { ProviderSigner } from "./provider/adapter";

export interface DocumentSignerRow {
  email: string;
  /** Signature-field placements for this assignment, in signing order. */
  signset?: unknown;
  executionMode?: "MANUAL" | "AUTOMATIC";
}

function readSignFields(signset: unknown): unknown[] {
  return Array.isArray(signset) ? signset : [];
}

export function buildDocumentProviderSigners(
  rows: readonly DocumentSignerRow[]
): ProviderSigner[] {
  const byKey = new Map<
    string,
    { email: string; fields: unknown[]; executionMode: "MANUAL" | "AUTOMATIC" }
  >();
  for (const row of rows) {
    const executionMode = row.executionMode === "AUTOMATIC" ? "AUTOMATIC" : "MANUAL";
    const emailKey = normalizeSigningEmail(row.email);
    const key = `${executionMode}:${emailKey}`;
    const colliding = [...byKey.values()].find(
      (signer) =>
        normalizeSigningEmail(signer.email) === emailKey && signer.executionMode !== executionMode
    );
    if (colliding) {
      throw new AppError(
        400,
        "SIGNING_BINDINGS_INVALID",
        `SigningCloud email ${emailKey} cannot be both a manual signer and an automatic CashSouk signer on the same document.`
      );
    }
    const signer = byKey.get(key);
    if (signer) {
      signer.fields.push(...readSignFields(row.signset));
      continue;
    }
    byKey.set(key, {
      email: row.email,
      fields: [...readSignFields(row.signset)],
      executionMode,
    });
  }
  return [...byKey.values()].map(({ email, fields, executionMode }) => ({
    email,
    executionMode,
    signset: fields.length > 0 ? fields : executionMode === "AUTOMATIC" ? [] : undefined,
  }));
}
