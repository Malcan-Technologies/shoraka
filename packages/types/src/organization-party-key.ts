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

/**
 * Lookup key for OPP / supplement / people[] rows.
 * Generated `user:{uuid}` keys stay exact (colon and hyphens). Government IDs keep existing normalization.
 */
export function resolvePartyLookupKey(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  if (isGeneratedUserPartyKey(trimmed)) return trimmed;
  return canonicalPartyIdentityKey(trimmed);
}

export function partyKeyMatchesLookup(
  stored: string | null | undefined,
  input: string | null | undefined
): boolean {
  const a = String(stored ?? "").trim();
  const b = String(input ?? "").trim();
  if (!a || !b) return false;
  if (isGeneratedUserPartyKey(a) || isGeneratedUserPartyKey(b)) return a === b;
  return resolvePartyLookupKey(a) === resolvePartyLookupKey(b);
}

/** Government ID shown to users. Never treat a generated party_key as NRIC/passport. */
export function displayGovernmentIdentityNumber(params: {
  partyKey?: string | null;
  identityNumber?: string | null;
}): string | null {
  const identity = String(params.identityNumber ?? "").trim();
  if (identity) return identity;
  const key = String(params.partyKey ?? "").trim();
  if (!key || isGeneratedUserPartyKey(key)) return null;
  return key;
}

/**
 * RegTank `governmentIdNumber` for Person Send.
 * Generated keys must not be sent as identity. `referenceId` remains correlation only.
 */
export function governmentIdNumberForOnboardingSend(params: {
  partyKey: string;
  identityNumber?: string | null;
  fallbackIdNumber?: string | null;
  fallbackEnquiryId?: string | null;
}): string {
  const fromIdentity = canonicalPartyIdentityKey(params.identityNumber);
  if (fromIdentity) return fromIdentity;
  if (isGeneratedUserPartyKey(params.partyKey)) return "";
  const fromDisplay = canonicalPartyIdentityKey(params.fallbackIdNumber);
  if (fromDisplay) return fromDisplay;
  return String(params.fallbackEnquiryId ?? "").trim();
}

export function usablePersonSendName(name: string | null | undefined): string | null {
  const trimmed = String(name ?? "").trim();
  return trimmed || null;
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
  entity_type?: string | null;
  entityType?: string | null;
};

function rowEntityType(row: PartyKeyRow): string | null {
  const raw = row.entity_type ?? row.entityType ?? null;
  return raw == null ? null : String(raw);
}

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
  identityKey: string,
  options?: { entityType?: string | null }
): T | undefined {
  const raw = String(identityKey ?? "").trim();
  if (!raw) return undefined;
  const wantType = options?.entityType ? String(options.entityType) : null;
  const typeOk = (row: T) => {
    if (!wantType) return true;
    const rowType = rowEntityType(row);
    return !rowType || rowType === wantType;
  };
  if (isGeneratedUserPartyKey(raw)) {
    return rows.find((row) => typeOk(row) && rowPartyKey(row) === raw);
  }
  const want = canonicalPartyIdentityKey(raw);
  if (!want) return undefined;
  return rows.find((row) => {
    if (!typeOk(row)) return false;
    const key = rowPartyKey(row);
    if (isGeneratedUserPartyKey(key)) {
      return canonicalPartyIdentityKey(rowIdentityNumber(row)) === want;
    }
    if (canonicalPartyIdentityKey(key) === want) return true;
    if (canonicalPartyIdentityKey(rowIdentityNumber(row)) === want) return true;
    if (key.toLowerCase().startsWith(LEGACY_MGMT_PARTY_KEY_PREFIX)) {
      return canonicalPartyIdentityKey(stripGeneratedPartyKeyPrefix(key)) === want;
    }
    return false;
  });
}

export function partySeenInExternalKeys(
  row: PartyKeyRow,
  seen: ReadonlySet<string>
): boolean {
  const key = rowPartyKey(row);
  if (seen.has(key)) return true;
  const identity = canonicalPartyIdentityKey(rowIdentityNumber(row));
  if (identity && seen.has(identity)) return true;
  if (isGeneratedUserPartyKey(key)) return false;
  const canonicalKey = canonicalPartyIdentityKey(key);
  if (canonicalKey && seen.has(canonicalKey)) return true;
  if (key.toLowerCase().startsWith(LEGACY_MGMT_PARTY_KEY_PREFIX)) {
    const stripped = canonicalPartyIdentityKey(stripGeneratedPartyKeyPrefix(key));
    if (stripped && seen.has(stripped)) return true;
  }
  return false;
}
