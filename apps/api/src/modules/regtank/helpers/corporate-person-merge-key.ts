import { normalizeDirectorShareholderIdKey } from "@cashsouk/types";

export type CorporatePersonMergeIdentity = {
  governmentIdNumber?: string | null;
  name?: string | null;
  eodRequestId?: string | null;
};

/**
 * Stable merge key for corporate director/shareholder identity.
 * Priority: governmentIdNumber → normalized full name → eodRequestId.
 * Email is intentionally never used (shared mailbox must not merge distinct people).
 */
export function resolveCorporatePersonMergeKey(identity: CorporatePersonMergeIdentity): string {
  const gov = normalizeDirectorShareholderIdKey(identity.governmentIdNumber ?? null);
  if (gov) return `gov:${gov}`;

  const name = String(identity.name ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  if (name) return `name:${name}`;

  const eod = String(identity.eodRequestId ?? "").trim();
  if (eod) return `eod:${eod}`;

  return "unknown:unidentified";
}

/** True when two corporate people should be treated as the same person for merge. */
export function corporatePersonIdentitiesMatch(
  left: CorporatePersonMergeIdentity & { shareholderEodRequestId?: string | null },
  right: CorporatePersonMergeIdentity
): boolean {
  const rightEod = String(right.eodRequestId ?? "").trim();
  if (rightEod) {
    if (String(left.eodRequestId ?? "").trim() === rightEod) return true;
    if (String(left.shareholderEodRequestId ?? "").trim() === rightEod) return true;
  }
  return resolveCorporatePersonMergeKey(left) === resolveCorporatePersonMergeKey(right);
}
