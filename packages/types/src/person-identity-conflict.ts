/**
 * Lightweight identity-collision marker stored on OPP `external_observation`.
 * Used when RegTank returns a government ID that already belongs to another Person.
 */

export const PERSON_IDENTITY_CONFLICT_KEY = "identityConflict" as const;

export const IDENTITY_CONFLICT_ADMIN_TITLE = "Identity conflict";
export const IDENTITY_CONFLICT_ADMIN_BODY =
  "This Person's RegTank identity matches another Person record. Review required.";
export const IDENTITY_CONFLICT_OBSERVED_BODY =
  "This CTOS Person conflicts with an onboarding Person. Do not Adopt until the identity conflict is reviewed.";
export const IDENTITY_CONFLICT_ISSUER_LABEL = "Identity needs Admin review";

export type PersonIdentityConflictStatus = "BLOCKED" | "RESOLVED_KEEP_ONBOARDING" | "RESOLVED_KEEP_CTOS";
export type PersonIdentityConflictSource = "REGTANK_QUERY" | "CTOS_OBSERVE";

export type PersonIdentityConflict = {
  status: PersonIdentityConflictStatus;
  canonicalIdentity: string;
  otherPartyId: string;
  otherPartyKey: string;
  otherMembershipStatus: string;
  source: PersonIdentityConflictSource;
  at: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parsePersonIdentityConflict(value: unknown): PersonIdentityConflict | null {
  const rec = isObject(value)
    ? isObject(value[PERSON_IDENTITY_CONFLICT_KEY])
      ? (value[PERSON_IDENTITY_CONFLICT_KEY] as Record<string, unknown>)
      : value
    : null;
  if (!rec) return null;
  const status = String(rec.status ?? "").trim().toUpperCase();
  const canonicalIdentity = String(rec.canonicalIdentity ?? "").trim();
  const otherPartyId = String(rec.otherPartyId ?? "").trim();
  const otherPartyKey = String(rec.otherPartyKey ?? "").trim();
  const otherMembershipStatus = String(rec.otherMembershipStatus ?? "").trim();
  const source = String(rec.source ?? "").trim().toUpperCase();
  const at = String(rec.at ?? "").trim();
  if (!canonicalIdentity || !otherPartyId) return null;
  if (status !== "BLOCKED" && status !== "RESOLVED_KEEP_ONBOARDING" && status !== "RESOLVED_KEEP_CTOS") {
    return null;
  }
  if (source !== "REGTANK_QUERY" && source !== "CTOS_OBSERVE") return null;
  return {
    status,
    canonicalIdentity,
    otherPartyId,
    otherPartyKey,
    otherMembershipStatus,
    source,
    at: at || new Date().toISOString(),
  };
}

export function readPersonIdentityConflict(observation: unknown): PersonIdentityConflict | null {
  return parsePersonIdentityConflict(observation);
}

export function isBlockedPersonIdentityConflict(
  conflict: PersonIdentityConflict | null | undefined
): boolean {
  return conflict?.status === "BLOCKED";
}

export function observationWithIdentityConflict(
  observation: Record<string, unknown> | null | undefined,
  conflict: PersonIdentityConflict
): Record<string, unknown> {
  return {
    ...(observation && isObject(observation) ? observation : {}),
    [PERSON_IDENTITY_CONFLICT_KEY]: conflict,
  };
}

function conflictBlocksObservedAdopt(
  conflict: PersonIdentityConflict | null
): conflict is PersonIdentityConflict {
  return conflict?.status === "BLOCKED" || conflict?.status === "RESOLVED_KEEP_ONBOARDING";
}

/** True when Adopt would duplicate a Person who already kept this identity. */
export function observedPartyBlockedByIdentityConflict(params: {
  observedPartyId: string;
  observedPartyKey?: string | null;
  parties: Array<{
    id: string;
    membershipStatus?: string | null;
    externalObservation?: unknown;
  }>;
}): boolean {
  const observedId = params.observedPartyId.trim();
  const observedKey = String(params.observedPartyKey ?? "").trim();
  if (!observedId) return false;
  return params.parties.some((party) => {
    if (party.id === observedId) return false;
    if (String(party.membershipStatus ?? "").trim() !== "MASTER_ACTIVE") return false;
    const conflict = readPersonIdentityConflict(party.externalObservation);
    if (!conflictBlocksObservedAdopt(conflict)) return false;
    return conflict.otherPartyId === observedId || (Boolean(observedKey) && conflict.otherPartyKey === observedKey);
  });
}
