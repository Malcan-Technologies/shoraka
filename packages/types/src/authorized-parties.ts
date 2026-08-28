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
  /** Live Prisma `application_guarantors.id` — rewritten at Step 1 submit. */
  application_guarantor_id: string;
  /** Stable form id — used for review item keys. */
  client_guarantor_id?: string;
  representatives: AuthorizedRepresentative[];
};

export type AuthorizedPartyIndividualGuarantor = {
  key: string;
  entity_kind: "INDIVIDUAL_GUARANTOR";
  /** Live Prisma `application_guarantors.id` — rewritten at Step 1 submit. */
  application_guarantor_id: string;
  /** Stable form id — used for review item keys. */
  client_guarantor_id?: string;
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
  const clientGuarantorId =
    typeof root.client_guarantor_id === "string" ? root.client_guarantor_id.trim() : "";

  if (entityKind === "CORPORATE_GUARANTOR") {
    const party: AuthorizedPartyCorporateGuarantor = {
      key: typeof root.key === "string" && root.key.trim() ? root.key.trim() : applicationGuarantorId,
      entity_kind: "CORPORATE_GUARANTOR",
      application_guarantor_id: applicationGuarantorId,
      representatives,
    };
    if (clientGuarantorId) party.client_guarantor_id = clientGuarantorId;
    return party;
  }

  if (entityKind === "INDIVIDUAL_GUARANTOR") {
    const party: AuthorizedPartyIndividualGuarantor = {
      key: typeof root.key === "string" && root.key.trim() ? root.key.trim() : applicationGuarantorId,
      entity_kind: "INDIVIDUAL_GUARANTOR",
      application_guarantor_id: applicationGuarantorId,
      representatives,
    };
    if (clientGuarantorId) party.client_guarantor_id = clientGuarantorId;
    return party;
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
        const serialized: AuthorizedPartyCorporateGuarantor = {
          key: party.key,
          entity_kind: "CORPORATE_GUARANTOR",
          application_guarantor_id: party.application_guarantor_id,
          representatives: party.representatives.map(serializeRepresentative),
        };
        if (party.client_guarantor_id) serialized.client_guarantor_id = party.client_guarantor_id;
        return serialized;
      }
      const serialized: AuthorizedPartyIndividualGuarantor = {
        key: party.key,
        entity_kind: "INDIVIDUAL_GUARANTOR",
        application_guarantor_id: party.application_guarantor_id,
        representatives: party.representatives.map(serializeRepresentative),
      };
      if (party.client_guarantor_id) serialized.client_guarantor_id = party.client_guarantor_id;
      return serialized;
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

export function loIssuerAuthorizedNames(
  snapshot: AuthorizedPartiesSnapshot | null | undefined
): string {
  const party = getIssuerAuthorizedParty(snapshot);
  if (!party) return "";
  return party.representatives
    .map((rep) => rep.name.trim())
    .filter(Boolean)
    .join(", ");
}

export type LoCorporateAuthorizedPartyNames = {
  partyKey: string;
  applicationGuarantorId: string;
  clientGuarantorId?: string;
  names: string[];
};

/** Every corporate guarantor party with all declared representative names. */
export function loCorporateAuthorizedNamesByParty(
  snapshot: AuthorizedPartiesSnapshot | null | undefined
): LoCorporateAuthorizedPartyNames[] {
  return loCorporateAuthorizedRepresentativesByParty(snapshot).map((row) => ({
    partyKey: row.partyKey,
    applicationGuarantorId: row.applicationGuarantorId,
    ...(row.clientGuarantorId ? { clientGuarantorId: row.clientGuarantorId } : {}),
    names: row.representatives.map((rep) => rep.name),
  }));
}

export type LoCorporateAuthorizedRepresentative = {
  name: string;
  nric: string;
  capacity: AuthorizedRepresentativeCapacity;
};

export type LoCorporateAuthorizedPartyRepresentatives = {
  partyKey: string;
  applicationGuarantorId: string;
  clientGuarantorId?: string;
  representatives: LoCorporateAuthorizedRepresentative[];
};

/** Corporate guarantor parties with name, NRIC, and capacity for LO merge. */
export function loCorporateAuthorizedRepresentativesByParty(
  snapshot: AuthorizedPartiesSnapshot | null | undefined
): LoCorporateAuthorizedPartyRepresentatives[] {
  if (!snapshot) return [];
  const rows: LoCorporateAuthorizedPartyRepresentatives[] = [];
  for (const party of snapshot.parties) {
    if (party.entity_kind !== "CORPORATE_GUARANTOR") continue;
    const representatives = party.representatives
      .map((rep) => ({
        name: rep.name.trim(),
        nric: rep.ic_number.trim(),
        capacity: rep.capacity,
      }))
      .filter((rep) => rep.name.length > 0);
    const row: LoCorporateAuthorizedPartyRepresentatives = {
      partyKey: party.key,
      applicationGuarantorId: party.application_guarantor_id,
      representatives,
    };
    if (party.client_guarantor_id) row.clientGuarantorId = party.client_guarantor_id;
    rows.push(row);
  }
  return rows;
}

export type AuthorizedPartyGuarantorLookup = {
  id: string;
  /** Stable form id — survives `application_guarantors` delete+recreate. */
  client_guarantor_id?: string | null;
  guarantor_type?: "individual" | "company" | null;
  name?: string | null;
  business_name?: string | null;
};

function rowMatchesGuarantorParty(
  row: AuthorizedPartyGuarantorLookup,
  party: AuthorizedPartyCorporateGuarantor | AuthorizedPartyIndividualGuarantor
): boolean {
  if (row.id === party.application_guarantor_id) return true;
  if (party.client_guarantor_id && row.client_guarantor_id === party.client_guarantor_id) {
    return true;
  }
  if (row.client_guarantor_id && row.client_guarantor_id === party.application_guarantor_id) {
    return true;
  }
  return false;
}

/**
 * Map snapshot party keys onto current guarantor rows.
 * Match live Prisma `id` or stable `client_guarantor_id` only — never leftover kind/order.
 */
export function matchAuthorizedPartiesToGuarantors(
  parties: readonly AuthorizedParty[],
  guarantors: readonly AuthorizedPartyGuarantorLookup[]
): Map<string, AuthorizedPartyGuarantorLookup> {
  const result = new Map<string, AuthorizedPartyGuarantorLookup>();
  const used = new Set<string>();

  for (const party of parties) {
    if (!isGuarantorAuthorizedParty(party)) continue;
    const row = guarantors.find((item) => !used.has(item.id) && rowMatchesGuarantorParty(item, party));
    if (!row) continue;
    result.set(party.key, row);
    used.add(row.id);
  }
  return result;
}

/** Resolve a posted guarantor id (Prisma or client form id) onto the live Prisma row id. */
export function resolveLiveApplicationGuarantorId(
  postedId: string | null | undefined,
  guarantors: readonly Pick<AuthorizedPartyGuarantorLookup, "id" | "client_guarantor_id">[]
): string | null {
  if (!postedId) return null;
  const row = guarantors.find(
    (item) => item.id === postedId || item.client_guarantor_id === postedId
  );
  return row?.id ?? null;
}

export function findAuthorizedPartyForGuarantor(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  guarantor: AuthorizedPartyGuarantorLookup,
  allGuarantors: readonly AuthorizedPartyGuarantorLookup[]
): AuthorizedParty | null {
  if (!snapshot) return null;
  const matches = matchAuthorizedPartiesToGuarantors(snapshot.parties, allGuarantors);
  for (const party of snapshot.parties) {
    if (!isGuarantorAuthorizedParty(party)) continue;
    if (matches.get(party.key)?.id === guarantor.id) return party;
  }
  return null;
}

/**
 * Map a previously submitted party onto the same legal entity in a new payload.
 * Prisma `application_guarantor_id` is rewritten when guarantor rows are recreated.
 */
export function findSubmittedPartyForSnapshotParty(
  snapshotParty: AuthorizedParty,
  snapshotParties: readonly AuthorizedParty[],
  submittedParties: readonly AuthorizedParty[],
  guarantors: readonly AuthorizedPartyGuarantorLookup[] = []
): AuthorizedParty | null {
  if (snapshotParty.entity_kind === "ISSUER") {
    return submittedParties.find((party) => party.entity_kind === "ISSUER") ?? null;
  }
  if (guarantors.length > 0) {
    const snapshotMatches = matchAuthorizedPartiesToGuarantors(snapshotParties, guarantors);
    const submittedMatches = matchAuthorizedPartiesToGuarantors(submittedParties, guarantors);
    const row = snapshotMatches.get(snapshotParty.key);
    if (row) {
      const submitted = submittedParties.find(
        (party) => submittedMatches.get(party.key)?.id === row.id
      );
      if (submitted) return submitted;
    }
  }
  const itemId = authorizedRepresentativeReviewItemId(snapshotParty);
  return (
    submittedParties.find((party) => authorizedRepresentativeReviewItemId(party) === itemId) ?? null
  );
}

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

export function authorizedPartyGroupTitle(
  entityKind: AuthorizedParty["entity_kind"]
): string {
  if (entityKind === "ISSUER") return "Issuer company";
  if (entityKind === "CORPORATE_GUARANTOR") return "Corporate guarantors";
  return "Individual guarantors";
}

export function authorizedPartyEntityTitle(
  party: AuthorizedParty,
  guarantor?: AuthorizedPartyGuarantorLookup | null
): string {
  if (party.entity_kind === "ISSUER") return authorizedPartyGroupTitle("ISSUER");
  if (party.entity_kind === "CORPORATE_GUARANTOR") {
    const businessName = guarantor?.business_name?.trim();
    return businessName || "Company guarantor";
  }
  const name = guarantor?.name?.trim() || party.representatives[0]?.name?.trim();
  return name || "Individual guarantor";
}

export type AuthorizedPartyReadOnlyBlock = {
  key: string;
  review_item_id: string;
  title: string;
  entity_kind: AuthorizedParty["entity_kind"];
  representatives: Array<{
    name: string;
    email: string;
    ic_number: string;
    capacity_label: string;
  }>;
};

export function authorizedPartyReadOnlyBlocks(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  guarantors: AuthorizedPartyGuarantorLookup[] = []
): AuthorizedPartyReadOnlyBlock[] {
  const matches = matchAuthorizedPartiesToGuarantors(snapshot?.parties ?? [], guarantors);
  return listAuthorizedPartiesInDisplayOrder(
    snapshot,
    guarantors.map((row) => row.id)
  ).map((party) => ({
    key: party.key,
    review_item_id: authorizedRepresentativeReviewItemId(party),
    title: authorizedPartyEntityTitle(
      party,
      isGuarantorAuthorizedParty(party) ? (matches.get(party.key) ?? null) : null
    ),
    entity_kind: party.entity_kind,
    representatives: party.representatives.map((rep) => ({
      name: rep.name,
      email: rep.email,
      ic_number: rep.ic_number,
      capacity_label: authorizedRepresentativeCapacityLabel(rep.capacity),
    })),
  }));
}

export type AuthorizedPartyReadOnlyGroup = {
  entity_kind: AuthorizedParty["entity_kind"];
  title: string;
  blocks: AuthorizedPartyReadOnlyBlock[];
};

const READ_ONLY_GROUP_ORDER: AuthorizedParty["entity_kind"][] = [
  "ISSUER",
  "CORPORATE_GUARANTOR",
  "INDIVIDUAL_GUARANTOR",
];

export function groupAuthorizedPartyReadOnlyBlocks(
  blocks: AuthorizedPartyReadOnlyBlock[]
): AuthorizedPartyReadOnlyGroup[] {
  return READ_ONLY_GROUP_ORDER.flatMap((entityKind) => {
    const grouped = blocks.filter((block) => block.entity_kind === entityKind);
    if (grouped.length === 0) return [];
    return [
      {
        entity_kind: entityKind,
        title: authorizedPartyGroupTitle(entityKind),
        blocks: grouped,
      },
    ];
  });
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

/** Map guarantor snapshot reps onto guarantor bindings (one binding per named person). */
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

export const AUTHORIZED_REPRESENTATIVES_ITEM_TYPE = "authorized_representatives" as const;
export const AUTHORIZED_REPRESENTATIVES_ITEM_ID_PREFIX = "authorized_representatives:" as const;
export const AUTHORIZED_REPRESENTATIVES_ISSUER_ITEM_ID =
  `${AUTHORIZED_REPRESENTATIVES_ITEM_ID_PREFIX}issuer` as const;

export function authorizedRepresentativesGuarantorItemId(applicationGuarantorId: string): string {
  return `${AUTHORIZED_REPRESENTATIVES_ITEM_ID_PREFIX}guarantor:${applicationGuarantorId}`;
}

export function isAuthorizedRepresentativesItemId(itemId: string): boolean {
  return itemId.startsWith(AUTHORIZED_REPRESENTATIVES_ITEM_ID_PREFIX);
}

export function authorizedPartyStableGuarantorId(
  party: AuthorizedPartyCorporateGuarantor | AuthorizedPartyIndividualGuarantor
): string {
  return party.client_guarantor_id || party.application_guarantor_id;
}

export function authorizedRepresentativeReviewItemId(party: AuthorizedParty): string {
  if (party.entity_kind === "ISSUER") return AUTHORIZED_REPRESENTATIVES_ISSUER_ITEM_ID;
  return authorizedRepresentativesGuarantorItemId(authorizedPartyStableGuarantorId(party));
}

export function authorizedRepresentativeReviewItemIdForGuarantor(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  guarantor: AuthorizedPartyGuarantorLookup,
  allGuarantors: readonly AuthorizedPartyGuarantorLookup[]
): string {
  const party = findAuthorizedPartyForGuarantor(snapshot, guarantor, allGuarantors);
  if (party) return authorizedRepresentativeReviewItemId(party);
  return authorizedRepresentativesGuarantorItemId(guarantor.client_guarantor_id || guarantor.id);
}

export function collectAuthorizedRepresentativeReviewKeys(
  snapshot: AuthorizedPartiesSnapshot | null | undefined
): string[] {
  if (!snapshot) return [];
  return snapshot.parties.map((party) => authorizedRepresentativeReviewItemId(party));
}

export function findAuthorizedPartyForReviewItemId(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  itemId: string
): AuthorizedParty | null {
  if (!snapshot) return null;
  return (
    snapshot.parties.find((party) => authorizedRepresentativeReviewItemId(party) === itemId) ?? null
  );
}

function representativeFingerprint(rep: AuthorizedRepresentative): string {
  return [
    rep.name.trim().toLowerCase(),
    normalizeSigningEmail(rep.email),
    normalizeSigningIcNumber(rep.ic_number),
    rep.capacity,
    rep.person_match_key ?? "",
  ].join("|");
}

/** Who is on the list — ignores rewritten Prisma guarantor ids. */
export function authorizedPartyListFingerprint(party: AuthorizedParty): string {
  const reps = party.representatives.map(representativeFingerprint).sort().join(";");
  return `${party.entity_kind}::${reps}`;
}

function isIssuerDirectorTemplateRole(role: { key: string; source_hint?: string | null }): boolean {
  return role.key === "issuer_director" || role.source_hint === "issuer_director";
}

function isGuarantorTemplateRole(role: { key: string; source_hint?: string | null }): boolean {
  return role.key === "guarantor" || role.source_hint === "guarantor";
}

export function snapshotSignerBindings(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  roles: Array<{ key: string; source_hint?: string | null }>
): RecipientBinding[] {
  if (!snapshot) return [];
  const bindings: RecipientBinding[] = [];
  for (const role of roles) {
    if (isIssuerDirectorTemplateRole(role)) {
      bindings.push(...issuerDirectorBindingsFromSnapshot(snapshot, role.key));
    } else if (isGuarantorTemplateRole(role)) {
      bindings.push(...guarantorBindingsFromSnapshot(snapshot, role.key));
    }
  }
  return bindings;
}

function bindingCompareKey(
  binding: RecipientBinding,
  includeIc: boolean
): string {
  const ic =
    includeIc && binding.ic_number ? normalizeSigningIcNumber(binding.ic_number) : "";
  return [
    binding.role_key,
    normalizeSigningEmail(binding.email),
    binding.name.trim().toLowerCase(),
    binding.application_guarantor_id ?? "",
    ic,
  ].join("|");
}

/**
 * True when posted issuer_director / guarantor bindings match the approved snapshot.
 * Other template roles are ignored. Guarantor IC is ignored (self-declared on the link).
 */
export function postedBindingsMatchApprovedSnapshot(input: {
  snapshot: AuthorizedPartiesSnapshot | null | undefined;
  roles: Array<{ key: string; source_hint?: string | null }>;
  posted: RecipientBinding[];
}): boolean {
  if (!input.snapshot) return true;
  const expected = snapshotSignerBindings(input.snapshot, input.roles);
  if (expected.length === 0) return true;
  const expectedRoleKeys = new Set(expected.map((binding) => binding.role_key));
  const posted = input.posted.filter((binding) => expectedRoleKeys.has(binding.role_key));
  if (expected.length !== posted.length) return false;
  const guarantorRoleKeys = new Set(
    input.roles.filter(isGuarantorTemplateRole).map((role) => role.key)
  );
  const expectedKeys = expected
    .map((binding) => bindingCompareKey(binding, !guarantorRoleKeys.has(binding.role_key)))
    .sort();
  const postedKeys = posted
    .map((binding) => bindingCompareKey(binding, !guarantorRoleKeys.has(binding.role_key)))
    .sort();
  return expectedKeys.every((key, index) => key === postedKeys[index]);
}
