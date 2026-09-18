/**
 * SECTION: CTOS company extract usability + absence acknowledgement
 * WHY: A blank CTOS company record (wrong/missing SSM) is unusable evidence.
 *      It must warn, not treat every master person as gone, and must not block Finance.
 * INPUT: latest `company_json` plus optional party `external_observation`
 * OUTPUT: fingerprint, unusable flag, and whether absence still needs review
 */

import { normalizeDirectorShareholderIdKey } from "./director-shareholder-display";
import { isCtosComparableParty, partySeenInExternalKeys } from "./organization-party-key";
import type { OrganizationPartyProfileDto } from "./organization-party-profile";

export const CTOS_ABSENCE_ACK_FINGERPRINT_KEY = "absenceAcknowledgedExtractFingerprint";

const REGISTRATION_FIELDS = [
  "brn_ssm",
  "ic_lcno",
  "nic_brno",
  "additional_registration_no",
  "ssm",
  "registration_no",
  "registrationNumber",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textField(row: Record<string, unknown>, key: string): string | null {
  const raw = row[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

function partyIdentityKey(row: Record<string, unknown>): string | null {
  return (
    normalizeDirectorShareholderIdKey(textField(row, "nic_brno") ?? "") ??
    normalizeDirectorShareholderIdKey(textField(row, "ic_lcno") ?? "") ??
    normalizeDirectorShareholderIdKey(textField(row, "brn_ssm") ?? "") ??
    normalizeDirectorShareholderIdKey(textField(row, "additional_registration_no") ?? "")
  );
}

function relatedPartyRows(ctos: unknown): Record<string, unknown>[] {
  const root = asRecord(ctos);
  if (!root) return [];
  const rows: Record<string, unknown>[] = [];
  for (const listKey of ["directors", "shareholders"] as const) {
    const list = root[listKey];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const row = asRecord(item);
      if (row) rows.push(row);
    }
  }
  return rows;
}

/** True when latest CTOS has no matchable directors/shareholders. */
export function isUnusableCtosCompanyExtract(ctos: unknown): boolean {
  return relatedPartyRows(ctos).every((row) => !partyIdentityKey(row));
}

export function ctosCompanyRegistrationKey(ctos: unknown): string | null {
  const root = asRecord(ctos);
  if (!root) return null;
  const nested = asRecord(root.company) ?? asRecord(root.company_profile);
  for (const source of [root, nested]) {
    if (!source) continue;
    for (const field of REGISTRATION_FIELDS) {
      const key = normalizeDirectorShareholderIdKey(textField(source, field) ?? "");
      if (key) return key;
    }
  }
  return null;
}

/** Identity keys from latest related-party rows (same normalization as observation matching). */
export function ctosExtractIdentityKeys(ctos: unknown): Set<string> {
  const keys = new Set<string>();
  for (const row of relatedPartyRows(ctos)) {
    const key = partyIdentityKey(row);
    if (key) keys.add(key);
  }
  return keys;
}

/** True when this master person appears in the latest usable CTOS related-party lists. */
export function partyPresentInCtosExtract(
  party: Partial<Pick<OrganizationPartyProfileDto, "partyKey" | "identityNumber">>,
  latestCtos: unknown
): boolean {
  if (isUnusableCtosCompanyExtract(latestCtos)) return false;
  return partySeenInExternalKeys(
    { partyKey: party.partyKey, identityNumber: party.identityNumber },
    ctosExtractIdentityKeys(latestCtos)
  );
}

/** Stable fingerprint of the latest related-party extract. Blank extracts share `unusable`. */
export function ctosExtractFingerprint(ctos: unknown): string {
  if (isUnusableCtosCompanyExtract(ctos)) return "unusable";
  const keys = ctosExtractIdentityKeys(ctos);
  const registration = ctosCompanyRegistrationKey(ctos);
  if (registration) keys.add(`reg:${registration}`);
  return [...keys].sort().join("|");
}

export function readCtosAbsenceAckFingerprint(observation: unknown): string | null {
  const rec = asRecord(observation);
  if (!rec) return null;
  const raw = rec[CTOS_ABSENCE_ACK_FINGERPRINT_KEY];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function partyCtosAbsenceAckFingerprint(
  party: Pick<OrganizationPartyProfileDto, "ctosAbsenceAckFingerprint" | "externalObservation">
): string | null {
  const explicit = party.ctosAbsenceAckFingerprint?.trim();
  if (explicit) return explicit;
  return readCtosAbsenceAckFingerprint(party.externalObservation);
}

/**
 * Absence needs admin review when the person is still master, latest CTOS is usable,
 * they are missing from that extract, and the current extract has not been acknowledged.
 */
export function partyNeedsCtosAbsenceReview(
  party: Pick<
    OrganizationPartyProfileDto,
    | "membershipStatus"
    | "absentFromLatestExternal"
    | "externalObservation"
    | "ctosAbsenceAckFingerprint"
    | "ctosExtractUnusable"
    | "ctosAbsenceReviewNeeded"
  > &
    Partial<
      Pick<OrganizationPartyProfileDto, "partyKey" | "identityNumber" | "isDirector" | "isShareholder">
    >,
  latestCtos?: unknown
): boolean {
  if (party.membershipStatus !== "MASTER_ACTIVE") return false;
  if (party.ctosExtractUnusable) return false;
  if (latestCtos !== undefined && isUnusableCtosCompanyExtract(latestCtos)) return false;

  const comparable = isCtosComparableParty({
    isDirector: Boolean(party.isDirector),
    isShareholder: Boolean(party.isShareholder),
  });
  if (latestCtos !== undefined && partyPresentInCtosExtract(party, latestCtos)) return false;
  if (latestCtos !== undefined && comparable) {
    const fingerprint = ctosExtractFingerprint(latestCtos);
    const ack = partyCtosAbsenceAckFingerprint(party);
    if (ack && ack === fingerprint) return false;
    return true;
  }

  if (!party.absentFromLatestExternal) return false;
  if (party.ctosAbsenceReviewNeeded === false) return false;
  const fingerprint = latestCtos !== undefined ? ctosExtractFingerprint(latestCtos) : null;
  const ack = partyCtosAbsenceAckFingerprint(party);
  if (ack && fingerprint && ack === fingerprint) return false;
  return true;
}
