/**
 * Admin People & Access row model.
 * Reuses customer people-access labels and identity merge keys.
 * Adds CTOS, EXTERNAL_OBSERVED, owner-without-member, and Admin filters.
 * Never merge by email.
 */
import type { ApplicationPersonRow } from "./application-people-display";
import {
  filterVisiblePeopleRows,
  isMissingGovernmentIdPerson,
} from "./application-people-display";
import { getAmlGroup } from "./director-shareholder-single-status-display";
import { resolvePartyCtosComparison } from "./party-ctos-comparison";
import {
  isBlockedPersonIdentityConflict,
  observedPartyBlockedByIdentityConflict,
  readPersonIdentityConflict,
} from "./person-identity-conflict";
import { linkedPartyUserIds } from "./person-platform-access";
import type { OrganizationPartyProfileDto } from "./organization-party-profile";
import {
  formatPeopleAccessCompanyRoleLine,
  matchPersonToParty,
  peopleAccessAmlLabel,
  peopleAccessCompanyRolesFromParty,
  peopleAccessCompanyRolesFromPerson,
  peopleAccessKycLabel,
  peopleAccessPlatformLabel,
  type PeopleAccessAmlLabel,
  type PeopleAccessCompanyRole,
  type PeopleAccessKycLabel,
  type PeopleAccessMember,
  type PeopleAccessPlatformLabel,
  type PeopleAccessRowKind,
} from "./people-access-rows";

export type AdminPeopleAccessCtosLabel =
  | "Matched"
  | "Differs"
  | "Not found"
  | "Observed only"
  | "—";

export type AdminPeopleAccessPlatformCell = PeopleAccessPlatformLabel | "—";

export const ADMIN_PEOPLE_ACCESS_FILTERS = [
  "all",
  "company",
  "platform",
  "pending",
  "ctos-review",
  "inactive",
] as const;

export type AdminPeopleAccessFilter = (typeof ADMIN_PEOPLE_ACCESS_FILTERS)[number];

export type AdminPeopleAccessOwner = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type AdminPeopleAccessRow = {
  key: string;
  kind: PeopleAccessRowKind | "observed";
  name: string;
  companyRoles: PeopleAccessCompanyRole[];
  companyRoleLine: string;
  platformAccess: AdminPeopleAccessPlatformCell;
  kyc: PeopleAccessKycLabel;
  aml: PeopleAccessAmlLabel;
  ctos: AdminPeopleAccessCtosLabel;
  partyId: string | null;
  partyKey: string | null;
  userId: string | null;
  invitationId: string | null;
  invitationExpiresAt: string | null;
  personEmail: string | null;
  accountEmail: string | null;
  person: ApplicationPersonRow | null;
  party: OrganizationPartyProfileDto | null;
  member: PeopleAccessMember | null;
  inactive: boolean;
  observed: boolean;
  identityConflict: boolean;
  corporate: boolean;
};

export function isAdminPeopleAccessFilter(value: string | null | undefined): value is AdminPeopleAccessFilter {
  return Boolean(value && (ADMIN_PEOPLE_ACCESS_FILTERS as readonly string[]).includes(value));
}

export function adminPeopleAccessCtosLabel(
  party: OrganizationPartyProfileDto | null | undefined
): AdminPeopleAccessCtosLabel {
  if (!party) return "—";
  if (party.membershipStatus === "EXTERNAL_OBSERVED") return "Observed only";
  if (isBlockedPersonIdentityConflict(readPersonIdentityConflict(party.externalObservation))) {
    return "Differs";
  }
  const comparison = resolvePartyCtosComparison(party);
  if (comparison.state === "MATCHED") return "Matched";
  if (comparison.state === "DIFFERS") return "Differs";
  if (comparison.state === "NOT_FOUND") return "Not found";
  return "—";
}

export function adminPeopleAccessCtosBadgeStatus(
  label: AdminPeopleAccessCtosLabel
): "success" | "action" | null {
  if (label === "Matched") return "success";
  if (label === "Differs" || label === "Not found" || label === "Observed only") return "action";
  return null;
}

function amlFromScreening(status: string | null | undefined): PeopleAccessAmlLabel {
  const group = getAmlGroup(status ?? "");
  switch (group) {
    case "NOT_STARTED":
      return "Not started";
    case "IN_PROGRESS":
    case "UNDER_REVIEW":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return "Pending";
  }
}

export function adminPeopleAccessAmlLabel(params: {
  person: ApplicationPersonRow | null | undefined;
  entityType?: string | null;
}): PeopleAccessAmlLabel {
  const entityType = params.entityType || params.person?.entityType;
  if (entityType === "CORPORATE") {
    const status = params.person?.screening?.status;
    if (!status || !String(status).trim()) return "—";
    return amlFromScreening(status);
  }
  return peopleAccessAmlLabel(params.person);
}

function memberDisplayName(member: PeopleAccessMember): string {
  return [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || member.email;
}

function ownerDisplayName(owner: AdminPeopleAccessOwner): string {
  return [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim() || owner.email || owner.userId;
}

function personForParty(
  party: OrganizationPartyProfileDto,
  people: ApplicationPersonRow[],
  matchedKeys: Set<string>
): ApplicationPersonRow | null {
  const person = people.find((row) => {
    if (!row.matchKey) return false;
    const hit = matchPersonToParty(row, [party]);
    if (hit && row.matchKey) matchedKeys.add(row.matchKey);
    return Boolean(hit);
  });
  return person ?? null;
}

function identityConflictOnRow(
  party: OrganizationPartyProfileDto | null,
  allParties: OrganizationPartyProfileDto[]
): boolean {
  if (!party) return false;
  if (isBlockedPersonIdentityConflict(readPersonIdentityConflict(party.externalObservation))) {
    return true;
  }
  if (party.membershipStatus !== "EXTERNAL_OBSERVED") return false;
  return observedPartyBlockedByIdentityConflict({
    observedPartyId: party.id,
    observedPartyKey: party.partyKey,
    parties: allParties,
  });
}

function platformAccessCell(params: {
  party: OrganizationPartyProfileDto | null;
  ownerUserId: string | null;
  observed: boolean;
  peopleOnly: boolean;
}): AdminPeopleAccessPlatformCell {
  if (params.peopleOnly) return "—";
  if (params.party?.entityType === "CORPORATE") return "—";
  if (params.observed) return "—";
  if (!params.party) return "No access";
  return peopleAccessPlatformLabel({
    ownerUserId: params.ownerUserId,
    userId: params.party.userId,
    status: params.party.platformAccess.status,
  });
}

function kycCell(params: {
  person: ApplicationPersonRow | null;
  corporate: boolean;
  platformOnly: boolean;
}): PeopleAccessKycLabel {
  if (params.corporate || params.platformOnly) return "—";
  return peopleAccessKycLabel(params.person);
}

function toRow(params: {
  key: string;
  kind: AdminPeopleAccessRow["kind"];
  name: string;
  party: OrganizationPartyProfileDto | null;
  person: ApplicationPersonRow | null;
  member: PeopleAccessMember | null;
  ownerUserId: string | null;
  allParties: OrganizationPartyProfileDto[];
  userId?: string | null;
  accountEmail?: string | null;
  personEmail?: string | null;
}): AdminPeopleAccessRow {
  const observed = params.party?.membershipStatus === "EXTERNAL_OBSERVED";
  const inactive = params.party?.membershipStatus === "MASTER_INACTIVE";
  const corporate = params.party?.entityType === "CORPORATE" || params.person?.entityType === "CORPORATE";
  const peopleOnly = params.kind === "people_only";
  const platformOnly = params.kind === "platform_only";
  const companyRoles = params.party
    ? peopleAccessCompanyRolesFromParty(params.party)
    : params.person
      ? peopleAccessCompanyRolesFromPerson(params.person)
      : [];
  const kyc = observed ? "—" : kycCell({ person: params.person, corporate, platformOnly });
  const aml =
    platformOnly || observed
      ? "—"
      : adminPeopleAccessAmlLabel({
          person: params.person,
          entityType: params.party?.entityType ?? params.person?.entityType,
        });
  return {
    key: params.key,
    kind: observed ? "observed" : params.kind,
    name: params.name,
    companyRoles,
    companyRoleLine: formatPeopleAccessCompanyRoleLine(companyRoles),
    platformAccess: platformOnly
      ? params.userId && params.ownerUserId && params.userId === params.ownerUserId
        ? "Owner"
        : params.member?.role === "ORGANIZATION_ADMIN"
          ? "Admin"
          : "User"
      : platformAccessCell({
          party: params.party,
          ownerUserId: params.ownerUserId,
          observed: Boolean(observed),
          peopleOnly,
        }),
    kyc,
    aml,
    ctos: platformOnly || peopleOnly ? "—" : adminPeopleAccessCtosLabel(params.party),
    partyId: params.party?.id ?? null,
    partyKey: params.party?.partyKey ?? params.person?.matchKey ?? null,
    userId: params.userId ?? params.party?.userId ?? null,
    invitationId: params.party?.platformAccess.invitationId ?? null,
    invitationExpiresAt: params.party?.platformAccess.invitationExpiresAt ?? null,
    personEmail: params.personEmail ?? params.party?.email ?? params.person?.email ?? null,
    accountEmail: params.accountEmail ?? params.party?.linkedUser?.email ?? params.member?.email ?? null,
    person: params.person,
    party: params.party,
    member: params.member,
    inactive: Boolean(inactive),
    observed: Boolean(observed),
    identityConflict: identityConflictOnRow(params.party, params.allParties),
    corporate,
  };
}

export function buildAdminPeopleAccessRows(input: {
  parties: OrganizationPartyProfileDto[] | null | undefined;
  people: ApplicationPersonRow[] | null | undefined;
  members: PeopleAccessMember[];
  owner: AdminPeopleAccessOwner | null;
  now?: Date;
}): { active: AdminPeopleAccessRow[]; inactive: AdminPeopleAccessRow[] } {
  const partyList = input.parties ?? [];
  const visiblePeople = filterVisiblePeopleRows(input.people ?? []);
  const ownerUserId = input.owner?.userId ?? null;
  const matchedKeys = new Set<string>();

  const masterActive = partyList.filter((party) => party.membershipStatus === "MASTER_ACTIVE");
  const observedParties = partyList.filter((party) => party.membershipStatus === "EXTERNAL_OBSERVED");
  const inactiveParties = partyList.filter((party) => party.membershipStatus === "MASTER_INACTIVE");

  const activeCompany = masterActive.map((party) => {
    const person = personForParty(party, visiblePeople, matchedKeys);
    const member = party.userId ? input.members.find((row) => row.id === party.userId) ?? null : null;
    return toRow({
      key: `party:${party.id}`,
      kind: "company_person",
      name: party.name?.trim() || person?.name?.trim() || party.partyKey,
      party,
      person,
      member,
      ownerUserId,
      allParties: partyList,
      accountEmail: party.linkedUser?.email ?? member?.email ?? null,
    });
  });

  const observedRows = observedParties.map((party) => {
    const person = personForParty(party, visiblePeople, matchedKeys);
    return toRow({
      key: `party:${party.id}`,
      kind: "observed",
      name: party.name?.trim() || person?.name?.trim() || party.partyKey,
      party,
      person,
      member: null,
      ownerUserId,
      allParties: partyList,
    });
  });

  const linkedUserIds = linkedPartyUserIds(partyList);
  const emittedUserIds = new Set<string>();
  for (const row of activeCompany) {
    if (row.userId) emittedUserIds.add(row.userId);
  }
  for (const party of inactiveParties) {
    if (party.userId) emittedUserIds.add(party.userId);
  }

  const platformOnly: AdminPeopleAccessRow[] = [];

  if (ownerUserId && !linkedUserIds.has(ownerUserId) && !emittedUserIds.has(ownerUserId)) {
    const ownerMember = input.members.find((member) => member.id === ownerUserId) ?? null;
    const owner = input.owner;
    if (owner) {
      platformOnly.push(
        toRow({
          key: `user:${owner.userId}`,
          kind: "platform_only",
          name: ownerMember ? memberDisplayName(ownerMember) : ownerDisplayName(owner),
          party: null,
          person: null,
          member: ownerMember,
          ownerUserId,
          allParties: partyList,
          userId: owner.userId,
          accountEmail: ownerMember?.email ?? owner.email,
        })
      );
      emittedUserIds.add(owner.userId);
    }
  }

  for (const member of input.members) {
    if (linkedUserIds.has(member.id)) continue;
    if (emittedUserIds.has(member.id)) continue;
    platformOnly.push(
      toRow({
        key: `user:${member.id}`,
        kind: "platform_only",
        name: memberDisplayName(member),
        party: null,
        person: null,
        member,
        ownerUserId,
        allParties: partyList,
        userId: member.id,
        accountEmail: member.email,
      })
    );
    emittedUserIds.add(member.id);
  }

  const peopleOnly = visiblePeople
    .filter(
      (person) =>
        Boolean(person.matchKey) &&
        !matchedKeys.has(person.matchKey) &&
        !matchPersonToParty(person, partyList) &&
        !isMissingGovernmentIdPerson(person)
    )
    .map((person) =>
      toRow({
        key: `people:${person.matchKey}`,
        kind: "people_only",
        name: person.name?.trim() || person.matchKey || "Unnamed",
        party: null,
        person,
        member: null,
        ownerUserId,
        allParties: partyList,
        personEmail: person.email ?? person.userEmail ?? null,
      })
    );

  const inactive = inactiveParties.map((party) => {
    const person = personForParty(party, visiblePeople, matchedKeys);
    const member = party.userId ? input.members.find((row) => row.id === party.userId) ?? null : null;
    return toRow({
      key: `party:${party.id}`,
      kind: "company_person",
      name: party.name?.trim() || person?.name?.trim() || party.partyKey,
      party,
      person,
      member,
      ownerUserId,
      allParties: partyList,
      accountEmail: party.linkedUser?.email ?? member?.email ?? null,
    });
  });

  return {
    active: [...activeCompany, ...observedRows, ...platformOnly, ...peopleOnly],
    inactive,
  };
}

function pendingKyc(label: PeopleAccessKycLabel): boolean {
  return label === "In progress" || label === "Pending approval";
}

function needsCtosReview(row: AdminPeopleAccessRow): boolean {
  return (
    row.ctos === "Observed only" ||
    row.ctos === "Differs" ||
    row.ctos === "Not found" ||
    row.identityConflict
  );
}

export function adminPeopleAccessRowNeedsAttention(row: AdminPeopleAccessRow): boolean {
  return (
    row.platformAccess === "Invitation sent" ||
    row.platformAccess === "Invitation expired" ||
    pendingKyc(row.kyc) ||
    needsCtosReview(row)
  );
}

export function filterAdminPeopleAccessRows(
  rows: AdminPeopleAccessRow[],
  filter: AdminPeopleAccessFilter,
  search: string
): AdminPeopleAccessRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter === "all" && row.inactive) return false;
    if (filter === "inactive") return row.inactive && matchesSearch(row, q);
    if (row.inactive) return false;
    if (filter === "company" && row.companyRoles.length === 0) return false;
    if (filter === "platform") {
      if (
        row.platformAccess !== "Owner" &&
        row.platformAccess !== "Admin" &&
        row.platformAccess !== "User"
      ) {
        return false;
      }
    }
    if (filter === "pending" && !adminPeopleAccessRowNeedsAttention(row)) return false;
    if (filter === "ctos-review" && !needsCtosReview(row)) return false;
    return matchesSearch(row, q);
  });
}

function matchesSearch(row: AdminPeopleAccessRow, q: string): boolean {
  if (!q) return true;
  const haystack = [
    row.name,
    row.companyRoleLine,
    row.platformAccess,
    row.personEmail,
    row.accountEmail,
    row.partyKey,
    row.party?.identityNumber,
    row.person?.identityNumber,
    row.person?.matchKey,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function picContactsDiffer(
  contact: {
    name?: string | null;
    position?: string | null;
    email?: string | null;
    contact?: string | null;
  } | null | undefined,
  evidence: {
    name?: string | null;
    position?: string | null;
    email?: string | null;
    contactNumber?: string | null;
  } | null | undefined
): boolean {
  const evidencePresent = Boolean(
    evidence?.name?.trim() || evidence?.position?.trim() || evidence?.email?.trim() || evidence?.contactNumber?.trim()
  );
  if (!evidencePresent) return false;
  const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
  return (
    norm(contact?.name) !== norm(evidence?.name) ||
    norm(contact?.position) !== norm(evidence?.position) ||
    norm(contact?.email) !== norm(evidence?.email) ||
    norm(contact?.contact) !== norm(evidence?.contactNumber)
  );
}
