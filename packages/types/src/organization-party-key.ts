import { normalizeDirectorShareholderIdKey } from "./director-shareholder-display";

/** Legacy prefix used when management members were keyed separately from CTOS identity. */
export const LEGACY_MGMT_PARTY_KEY_PREFIX = "mgmt:";
/** Stable key for a user-added person who has no identity number yet. */
export const USER_GENERATED_PARTY_KEY_PREFIX = "user:";

export function canonicalPartyIdentityKey(raw: string | null | undefined): string | null {
  return normalizeDirectorShareholderIdKey(raw);
}

export function stripGeneratedPartyKeyPrefix(partyKey: string): string {
  if (partyKey.toLowerCase().startsWith(LEGACY_MGMT_PARTY_KEY_PREFIX)) {
    return partyKey.slice(LEGACY_MGMT_PARTY_KEY_PREFIX.length);
  }
  if (partyKey.toLowerCase().startsWith(USER_GENERATED_PARTY_KEY_PREFIX)) {
    return partyKey.slice(USER_GENERATED_PARTY_KEY_PREFIX.length);
  }
  return partyKey;
}

export function isGeneratedUserPartyKey(partyKey: string): boolean {
  return partyKey.toLowerCase().startsWith(USER_GENERATED_PARTY_KEY_PREFIX);
}

export function isCtosComparableParty(flags: {
  isDirector: boolean;
  isShareholder: boolean;
}): boolean {
  return flags.isDirector || flags.isShareholder;
}

export function isManagementOnlyParty(flags: {
  isDirector: boolean;
  isShareholder: boolean;
  isBoard?: boolean;
  isManagement?: boolean;
}): boolean {
  return !flags.isDirector && !flags.isShareholder;
}

type PartyKeyRow = {
  party_key?: string;
  partyKey?: string;
  identity_number?: string | null;
  identityNumber?: string | null;
};

function rowPartyKey(row: PartyKeyRow): string {
  return String(row.party_key ?? row.partyKey ?? "");
}

function rowIdentityNumber(row: PartyKeyRow): string | null {
  const raw = row.identity_number ?? row.identityNumber ?? null;
  return raw == null ? null : String(raw);
}

/**
 * Match a CTOS/RegTank/manual identity to an existing master row.
 * Accepts hyphenated NRIC, legacy `mgmt:` keys, and identity_number when party_key differs.
 */
export function findExistingPartyForIdentityKey<T extends PartyKeyRow>(
  rows: T[],
  identityKey: string
): T | undefined {
  const want = canonicalPartyIdentityKey(identityKey);
  if (!want) return undefined;
  return rows.find((row) => {
    const key = rowPartyKey(row);
    if (canonicalPartyIdentityKey(key) === want) return true;
    if (canonicalPartyIdentityKey(rowIdentityNumber(row)) === want) return true;
    if (canonicalPartyIdentityKey(stripGeneratedPartyKeyPrefix(key)) === want) return true;
    return false;
  });
}

export function partySeenInExternalKeys(
  row: PartyKeyRow,
  seen: ReadonlySet<string>
): boolean {
  const key = rowPartyKey(row);
  if (seen.has(key)) return true;
  const canonicalKey = canonicalPartyIdentityKey(key);
  if (canonicalKey && seen.has(canonicalKey)) return true;
  const identity = canonicalPartyIdentityKey(rowIdentityNumber(row));
  if (identity && seen.has(identity)) return true;
  const stripped = canonicalPartyIdentityKey(stripGeneratedPartyKeyPrefix(key));
  if (stripped && seen.has(stripped)) return true;
  return false;
}
