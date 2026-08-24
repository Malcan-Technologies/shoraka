/**
 * Authorised-representatives snapshot on offer_acceptance.
 * JSON only — grows by slice. Unknown party kinds are ignored on parse.
 */

import {
  isValidSigningIcNumber,
  normalizeSigningEmail,
  normalizeSigningIcNumber,
  type RecipientBinding,
} from "./signing-envelopes";

export const AUTHORIZED_PARTY_ISSUER_KEY = "issuer" as const;

export type AuthorizedRepresentativeCapacity = "director" | "authorised_signatory";

export type AuthorizedRepresentative = {
  name: string;
  email: string;
  ic_number: string;
  capacity: AuthorizedRepresentativeCapacity;
  /** SSM/CTOS people matchKey — required for issuer directors. */
  person_match_key?: string;
};

export type AuthorizedPartyIssuer = {
  key: typeof AUTHORIZED_PARTY_ISSUER_KEY;
  entity_kind: "ISSUER";
  representatives: AuthorizedRepresentative[];
};

export type AuthorizedPartyCorporateGuarantor = {
  key: string;
  entity_kind: "CORPORATE_GUARANTOR";
  application_guarantor_id: string;
  representatives: AuthorizedRepresentative[];
};

export type AuthorizedPartyIndividualGuarantor = {
  key: string;
  entity_kind: "INDIVIDUAL_GUARANTOR";
  application_guarantor_id: string;
  representatives: AuthorizedRepresentative[];
};

export type AuthorizedParty =
  | AuthorizedPartyIssuer
  | AuthorizedPartyCorporateGuarantor
  | AuthorizedPartyIndividualGuarantor;

export type AuthorizedPartiesSnapshot = {
  submitted_by_user_id: string;
  submitted_at: string;
  parties: AuthorizedParty[];
};

/** Client POST body — server stamps submitted_by_user_id / submitted_at. */
export type AuthorizedPartiesSubmitPayload = {
  parties: AuthorizedParty[];
};

const CAPACITIES: readonly AuthorizedRepresentativeCapacity[] = [
  "director",
  "authorised_signatory",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseCapacity(value: unknown): AuthorizedRepresentativeCapacity | null {
  return typeof value === "string" && CAPACITIES.includes(value as AuthorizedRepresentativeCapacity)
    ? (value as AuthorizedRepresentativeCapacity)
    : null;
}

function parseRepresentative(value: unknown): AuthorizedRepresentative | null {
  const root = asRecord(value);
  if (!root) return null;
  const name = typeof root.name === "string" ? root.name.trim() : "";
  const email = typeof root.email === "string" ? normalizeSigningEmail(root.email) : "";
  const icNumber =
    typeof root.ic_number === "string" ? normalizeSigningIcNumber(root.ic_number) : "";
  const capacity = parseCapacity(root.capacity);
  if (!name || !email || !capacity) return null;
  const representative: AuthorizedRepresentative = {
    name,
    email,
    ic_number: icNumber,
    capacity,
  };
  if (typeof root.person_match_key === "string" && root.person_match_key.trim()) {
    representative.person_match_key = root.person_match_key.trim();
  }
  return representative;
}

function parseRepresentatives(value: unknown): AuthorizedRepresentative[] {
  if (!Array.isArray(value)) return [];
  const reps: AuthorizedRepresentative[] = [];
  for (const item of value) {
    const parsed = parseRepresentative(item);
    if (parsed) reps.push(parsed);
  }
  return reps;
}

function parseParty(value: unknown): AuthorizedParty | null {
  const root = asRecord(value);
  if (!root) return null;
  const entityKind = typeof root.entity_kind === "string" ? root.entity_kind : "";
  const representatives = parseRepresentatives(root.representatives);
  if (representatives.length === 0) return null;

  if (entityKind === "ISSUER") {
    return {
      key: AUTHORIZED_PARTY_ISSUER_KEY,
      entity_kind: "ISSUER",
      representatives,
    };
  }

  const applicationGuarantorId =
    typeof root.application_guarantor_id === "string" ? root.application_guarantor_id.trim() : "";
  if (!applicationGuarantorId) return null;

  if (entityKind === "CORPORATE_GUARANTOR") {
    return {
      key: typeof root.key === "string" && root.key.trim() ? root.key.trim() : applicationGuarantorId,
      entity_kind: "CORPORATE_GUARANTOR",
      application_guarantor_id: applicationGuarantorId,
      representatives,
    };
  }

  if (entityKind === "INDIVIDUAL_GUARANTOR") {
    return {
      key: typeof root.key === "string" && root.key.trim() ? root.key.trim() : applicationGuarantorId,
      entity_kind: "INDIVIDUAL_GUARANTOR",
      application_guarantor_id: applicationGuarantorId,
      representatives,
    };
  }

  return null;
}

export function parseAuthorizedPartiesSnapshot(value: unknown): AuthorizedPartiesSnapshot | null {
  const root = asRecord(value);
  if (!root) return null;
  const submittedBy =
    typeof root.submitted_by_user_id === "string" ? root.submitted_by_user_id.trim() : "";
  const submittedAt = typeof root.submitted_at === "string" ? root.submitted_at.trim() : "";
  if (!submittedBy || !submittedAt) return null;
  if (!Array.isArray(root.parties)) return null;
  const parties: AuthorizedParty[] = [];
  for (const item of root.parties) {
    const parsed = parseParty(item);
    if (parsed) parties.push(parsed);
  }
  return {
    submitted_by_user_id: submittedBy,
    submitted_at: submittedAt,
    parties,
  };
}

export function serializeAuthorizedPartiesSnapshot(
  snapshot: AuthorizedPartiesSnapshot
): AuthorizedPartiesSnapshot {
  return {
    submitted_by_user_id: snapshot.submitted_by_user_id,
    submitted_at: snapshot.submitted_at,
    parties: snapshot.parties.map((party) => {
      if (party.entity_kind === "ISSUER") {
        return {
          key: AUTHORIZED_PARTY_ISSUER_KEY,
          entity_kind: "ISSUER",
          representatives: party.representatives.map(serializeRepresentative),
        };
      }
      if (party.entity_kind === "CORPORATE_GUARANTOR") {
        return {
          key: party.key,
          entity_kind: "CORPORATE_GUARANTOR",
          application_guarantor_id: party.application_guarantor_id,
          representatives: party.representatives.map(serializeRepresentative),
        };
      }
      return {
        key: party.key,
        entity_kind: "INDIVIDUAL_GUARANTOR",
        application_guarantor_id: party.application_guarantor_id,
        representatives: party.representatives.map(serializeRepresentative),
      };
    }),
  };
}

function serializeRepresentative(rep: AuthorizedRepresentative): AuthorizedRepresentative {
  const out: AuthorizedRepresentative = {
    name: rep.name,
    email: normalizeSigningEmail(rep.email),
    ic_number: normalizeSigningIcNumber(rep.ic_number),
    capacity: rep.capacity,
  };
  if (rep.person_match_key) out.person_match_key = rep.person_match_key;
  return out;
}

export function getIssuerAuthorizedParty(
  snapshot: AuthorizedPartiesSnapshot | null | undefined
): AuthorizedPartyIssuer | null {
  if (!snapshot) return null;
  const party = snapshot.parties.find(
    (item): item is AuthorizedPartyIssuer => item.entity_kind === "ISSUER"
  );
  return party ?? null;
}

export function isGuarantorAuthorizedParty(
  party: AuthorizedParty
): party is AuthorizedPartyCorporateGuarantor | AuthorizedPartyIndividualGuarantor {
  return party.entity_kind === "CORPORATE_GUARANTOR" || party.entity_kind === "INDIVIDUAL_GUARANTOR";
}

export function authorizedRepresentativeCapacityLabel(
  capacity: AuthorizedRepresentativeCapacity
): string {
  return capacity === "director" ? "Director" : "Authorised signatory";
}

export type AuthorizedPartyGuarantorLookup = {
  id: string;
  name?: string | null;
  business_name?: string | null;
};

/** Issuer first, then guarantors in `guarantorIds` order, then any remaining snapshot guarantors. */
export function listAuthorizedPartiesInDisplayOrder(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  guarantorIds: string[] = []
): AuthorizedParty[] {
  if (!snapshot) return [];
  const issuer = snapshot.parties.filter(
    (party): party is AuthorizedPartyIssuer => party.entity_kind === "ISSUER"
  );
  const byGuarantorId = new Map<string, AuthorizedPartyCorporateGuarantor | AuthorizedPartyIndividualGuarantor>();
  for (const party of snapshot.parties) {
    if (!isGuarantorAuthorizedParty(party)) continue;
    byGuarantorId.set(party.application_guarantor_id, party);
  }
  const ordered: Array<AuthorizedPartyCorporateGuarantor | AuthorizedPartyIndividualGuarantor> = [];
  const seen = new Set<string>();
  for (const id of guarantorIds) {
    const party = byGuarantorId.get(id);
    if (!party || seen.has(id)) continue;
    ordered.push(party);
    seen.add(id);
  }
  for (const party of snapshot.parties) {
    if (!isGuarantorAuthorizedParty(party)) continue;
    if (seen.has(party.application_guarantor_id)) continue;
    ordered.push(party);
    seen.add(party.application_guarantor_id);
  }
  return [...issuer, ...ordered];
}

export function authorizedPartyEntityTitle(
  party: AuthorizedParty,
  guarantor?: AuthorizedPartyGuarantorLookup | null
): string {
  if (party.entity_kind === "ISSUER") return "Issuer representatives";
  if (party.entity_kind === "CORPORATE_GUARANTOR") {
    const businessName = guarantor?.business_name?.trim();
    return businessName || "Company guarantor";
  }
  const name = guarantor?.name?.trim() || party.representatives[0]?.name?.trim();
  return name || "Individual guarantor";
}

export type AuthorizedPartyReadOnlyBlock = {
  key: string;
  title: string;
  entity_kind: AuthorizedParty["entity_kind"];
  representatives: Array<{
    name: string;
    email: string;
    capacity_label: string;
  }>;
};

export function authorizedPartyReadOnlyBlocks(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  guarantors: AuthorizedPartyGuarantorLookup[] = []
): AuthorizedPartyReadOnlyBlock[] {
  const byId = new Map(guarantors.map((row) => [row.id, row]));
  return listAuthorizedPartiesInDisplayOrder(
    snapshot,
    guarantors.map((row) => row.id)
  ).map((party) => ({
    key: party.key,
    title: authorizedPartyEntityTitle(
      party,
      isGuarantorAuthorizedParty(party) ? byId.get(party.application_guarantor_id) : null
    ),
    entity_kind: party.entity_kind,
    representatives: party.representatives.map((rep) => ({
      name: rep.name,
      email: rep.email,
      capacity_label: authorizedRepresentativeCapacityLabel(rep.capacity),
    })),
  }));
}

export function stampAuthorizedPartiesSnapshot(input: {
  parties: AuthorizedParty[];
  submittedByUserId: string;
  submittedAt: string;
}): AuthorizedPartiesSnapshot {
  return serializeAuthorizedPartiesSnapshot({
    submitted_by_user_id: input.submittedByUserId,
    submitted_at: input.submittedAt,
    parties: input.parties,
  });
}

export type AuthorizedPartiesLogSummary = {
  submitted_by_user_id: string;
  parties: Array<{
    key: string;
    entity_kind: AuthorizedParty["entity_kind"];
    representative_count: number;
    names: string[];
  }>;
};

export function summarizeAuthorizedParties(
  snapshot: AuthorizedPartiesSnapshot
): AuthorizedPartiesLogSummary {
  return {
    submitted_by_user_id: snapshot.submitted_by_user_id,
    parties: snapshot.parties.map((party) => ({
      key: party.key,
      entity_kind: party.entity_kind,
      representative_count: party.representatives.length,
      names: party.representatives.map((rep) => rep.name),
    })),
  };
}

/** Map issuer snapshot reps onto issuer_director bindings (snapshot order). */
export function issuerDirectorBindingsFromSnapshot(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  roleKey: string
): RecipientBinding[] {
  const party = getIssuerAuthorizedParty(snapshot);
  if (!party) return [];
  return party.representatives.map((rep) => ({
    role_key: roleKey,
    name: rep.name,
    email: rep.email,
    ic_number: isValidSigningIcNumber(rep.ic_number) ? rep.ic_number : null,
  }));
}

/** Map guarantor snapshot reps onto guarantor bindings (snapshot party order, one binding per rep). */
export function guarantorBindingsFromSnapshot(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  roleKey: string
): RecipientBinding[] {
  if (!snapshot) return [];
  const bindings: RecipientBinding[] = [];
  for (const party of snapshot.parties) {
    if (!isGuarantorAuthorizedParty(party)) continue;
    for (const rep of party.representatives) {
      bindings.push({
        role_key: roleKey,
        name: rep.name,
        email: rep.email,
        ic_number: isValidSigningIcNumber(rep.ic_number) ? rep.ic_number : null,
        application_guarantor_id: party.application_guarantor_id,
      });
    }
  }
  return bindings;
}
