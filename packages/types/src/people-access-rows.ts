/**
 * Display-only People & Access row model.
 * Merge keys are party id / user id / invitation id — never email.
 */
import type { ApplicationPersonRow } from "./application-people-display";
import { filterVisiblePeopleRows, isMissingGovernmentIdPerson, requiresOnboardingEmail } from "./application-people-display";
import {
  getFinalStatusLabel,
  type DirectorShareholderFinalStatusPresentation,
} from "./director-shareholder-final-status";
import { getAmlGroup, getKycGroup } from "./director-shareholder-single-status-display";
import { findExistingPartyForIdentityKey } from "./organization-party-key";
import type { OrganizationPartyProfileDto } from "./organization-party-profile";
import {
  peopleAccessShowsCorporateAmlChip,
  peopleAccessShowsCorporateKycChip,
} from "./people-access-refresh";
import {
  isMemberWithoutCompanyRole,
  linkedPartyUserIds,
  type PersonPlatformAccessStatus,
} from "./person-platform-access";

export type PeopleAccessRowKind =
  | "company_person"
  | "platform_only"
  | "unscoped_invite"
  | "people_only";

export type PeopleAccessCompanyRole =
  | "Director"
  | "Shareholder"
  | "Board Member"
  | "Management";

export type PeopleAccessPlatformLabel =
  | "Owner"
  | "Admin"
  | "User"
  | "Invitation sent"
  | "Invitation expired"
  | "No access";

export type PeopleAccessKycLabel =
  | "—"
  | "Not started"
  | "In progress"
  | "Pending approval"
  | "Approved"
  | "Rejected"
  | "Expired";

export type PeopleAccessAmlLabel = "—" | "Not started" | "Pending" | "Approved" | "Rejected";

export type PeopleAccessFilter = "all" | "company" | "platform" | "pending";

export type PeopleAccessMember = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER";
};

export type PeopleAccessInvitation = {
  id: string;
  email: string;
  role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER";
  expiresAt: string | Date;
  token?: string;
  partyProfileId?: string | null;
  accepted?: boolean;
};

export type PeopleAccessRow = {
  key: string;
  kind: PeopleAccessRowKind;
  name: string;
  companyRoles: PeopleAccessCompanyRole[];
  companyRoleLine: string;
  platformAccess: PeopleAccessPlatformLabel;
  kyc: PeopleAccessKycLabel;
  aml: PeopleAccessAmlLabel;
  partyId: string | null;
  partyKey: string | null;
  userId: string | null;
  invitationId: string | null;
  invitationEmail: string | null;
  invitationToken: string | null;
  invitationRole: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER" | null;
  invitationExpiresAt: string | null;
  personEmail: string | null;
  accountEmail: string | null;
  person: ApplicationPersonRow | null;
  party: OrganizationPartyProfileDto | null;
  member: PeopleAccessMember | null;
};

export function matchPersonToParty(
  person: ApplicationPersonRow,
  parties: OrganizationPartyProfileDto[]
): OrganizationPartyProfileDto | undefined {
  const identity = person.matchKey?.trim();
  if (!identity) return undefined;
  return parties.find((party) =>
    Boolean(
      findExistingPartyForIdentityKey(
        [
          {
            partyKey: party.partyKey,
            identityNumber: party.identityNumber,
            entityType: party.entityType,
          },
        ],
        identity,
        { entityType: person.entityType }
      )
    )
  );
}

export function peopleAccessCompanyRolesFromParty(
  party: Pick<OrganizationPartyProfileDto, "isDirector" | "isShareholder" | "isBoard" | "isManagement">
): PeopleAccessCompanyRole[] {
  const roles: PeopleAccessCompanyRole[] = [];
  if (party.isDirector) roles.push("Director");
  if (party.isShareholder) roles.push("Shareholder");
  if (party.isBoard) roles.push("Board Member");
  if (party.isManagement) roles.push("Management");
  return roles;
}

export function peopleAccessCompanyRolesFromPerson(person: ApplicationPersonRow): PeopleAccessCompanyRole[] {
  const roles = (person.roles ?? []).map((role) => String(role).toUpperCase());
  const out: PeopleAccessCompanyRole[] = [];
  if (roles.includes("DIRECTOR")) out.push("Director");
  if (roles.includes("SHAREHOLDER")) out.push("Shareholder");
  if (roles.includes("BOARD")) out.push("Board Member");
  if (roles.includes("MANAGEMENT")) out.push("Management");
  return out;
}

export function formatPeopleAccessCompanyRoleLine(roles: PeopleAccessCompanyRole[]): string {
  return roles.length > 0 ? roles.join(", ") : "—";
}

export function peopleAccessPlatformLabel(input: {
  ownerUserId: string | null | undefined;
  userId: string | null | undefined;
  status: PersonPlatformAccessStatus | null | undefined;
}): PeopleAccessPlatformLabel {
  if (input.userId && input.ownerUserId && input.userId === input.ownerUserId) {
    return "Owner";
  }
  switch (input.status) {
    case "ORGANIZATION_ADMIN":
      return "Admin";
    case "ORGANIZATION_MEMBER":
      return "User";
    case "INVITATION_PENDING":
      return "Invitation sent";
    case "INVITATION_EXPIRED":
      return "Invitation expired";
    default:
      return "No access";
  }
}

export function peopleAccessKycLabel(person: ApplicationPersonRow | null | undefined): PeopleAccessKycLabel {
  if (!person || !requiresOnboardingEmail(person)) return "—";
  return kycGroupToPeopleAccessLabel(getKycGroup(person.onboarding?.status ?? ""));
}

/** Corporate KYB onboarding — never an individual KYC status. */
export function peopleAccessCorporateKybLabel(
  person: ApplicationPersonRow | null | undefined
): PeopleAccessKycLabel {
  if (!person || person.entityType !== "CORPORATE") return "—";
  const raw = person.onboarding?.status ?? "";
  if (!String(raw).trim()) return "—";
  return kycGroupToPeopleAccessLabel(getKycGroup(raw));
}

function kycGroupToPeopleAccessLabel(group: ReturnType<typeof getKycGroup>): PeopleAccessKycLabel {
  switch (group) {
    case "NOT_STARTED":
      return "Not started";
    case "IN_PROGRESS":
      return "In progress";
    case "PENDING_REVIEW":
      return "Pending approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "EXPIRED":
      return "Expired";
    default:
      return "In progress";
  }
}

export function peopleAccessAmlLabel(person: ApplicationPersonRow | null | undefined): PeopleAccessAmlLabel {
  if (!person || !requiresOnboardingEmail(person)) return "—";
  const group = getAmlGroup(person.screening?.status ?? "");
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

/** Same labels as onboarding review (`getFinalStatusLabel`). Null when the column is not applicable. */
export function peopleAccessKycChipPresentation(
  person: ApplicationPersonRow | null | undefined
): DirectorShareholderFinalStatusPresentation | null {
  if (!person) return null;
  if (person.entityType === "CORPORATE") {
    if (!peopleAccessShowsCorporateKycChip(person)) return null;
    return getFinalStatusLabel(person, { displayMode: "kyc_only" });
  }
  if (peopleAccessKycLabel(person) === "—") return null;
  return getFinalStatusLabel(person, { displayMode: "kyc_only" });
}

export function peopleAccessAmlChipPresentation(
  person: ApplicationPersonRow | null | undefined
): DirectorShareholderFinalStatusPresentation | null {
  if (!person) return null;
  if (person.entityType === "CORPORATE") {
    if (!peopleAccessShowsCorporateAmlChip(person)) return null;
    return getFinalStatusLabel({ screening: person.screening });
  }
  if (peopleAccessAmlLabel(person) === "—") return null;
  return getFinalStatusLabel({ screening: person.screening });
}

function memberDisplayName(member: PeopleAccessMember): string {
  return [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || member.email;
}

function invitationDisplayName(email: string): string {
  const trimmed = email.trim();
  if (trimmed.startsWith("invitation-") && trimmed.includes("@cashsouk.com")) {
    return "Invitation link";
  }
  return trimmed || "Invitation";
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function isExpired(expiresAt: string | Date, now: Date): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

function companyPersonRow(params: {
  party: OrganizationPartyProfileDto;
  person: ApplicationPersonRow | null;
  ownerUserId: string | null;
  members: PeopleAccessMember[];
}): PeopleAccessRow {
  const { party, person, ownerUserId, members } = params;
  const companyRoles = peopleAccessCompanyRolesFromParty(party);
  const member = party.userId ? members.find((row) => row.id === party.userId) ?? null : null;
  return {
    key: `party:${party.id}`,
    kind: "company_person",
    name: party.name?.trim() || person?.name?.trim() || party.partyKey,
    companyRoles,
    companyRoleLine: formatPeopleAccessCompanyRoleLine(companyRoles),
    platformAccess: peopleAccessPlatformLabel({
      ownerUserId,
      userId: party.userId,
      status: party.platformAccess.status,
    }),
    kyc: peopleAccessKycLabel(person),
    aml: peopleAccessAmlLabel(person),
    partyId: party.id,
    partyKey: party.partyKey,
    userId: party.userId,
    invitationId: party.platformAccess.invitationId,
    invitationEmail: null,
    invitationToken: null,
    invitationRole: party.platformAccess.memberRole,
    invitationExpiresAt: party.platformAccess.invitationExpiresAt,
    personEmail: party.email ?? person?.email ?? null,
    accountEmail: party.linkedUser?.email ?? member?.email ?? null,
    person,
    party,
    member,
  };
}

function platformOnlyRow(params: {
  member: PeopleAccessMember;
  ownerUserId: string | null;
}): PeopleAccessRow {
  const { member, ownerUserId } = params;
  const isOwner = member.id === ownerUserId;
  return {
    key: `user:${member.id}`,
    kind: "platform_only",
    name: memberDisplayName(member),
    companyRoles: [],
    companyRoleLine: "—",
    platformAccess: isOwner ? "Owner" : member.role === "ORGANIZATION_ADMIN" ? "Admin" : "User",
    kyc: "—",
    aml: "—",
    partyId: null,
    partyKey: null,
    userId: member.id,
    invitationId: null,
    invitationEmail: null,
    invitationToken: null,
    invitationRole: isOwner ? null : member.role,
    invitationExpiresAt: null,
    personEmail: null,
    accountEmail: member.email,
    person: null,
    party: null,
    member,
  };
}

function unscopedInviteRow(invitation: PeopleAccessInvitation, now: Date): PeopleAccessRow {
  const expired = isExpired(invitation.expiresAt, now);
  return {
    key: `invite:${invitation.id}`,
    kind: "unscoped_invite",
    name: invitationDisplayName(invitation.email),
    companyRoles: [],
    companyRoleLine: "—",
    platformAccess: expired ? "Invitation expired" : "Invitation sent",
    kyc: "—",
    aml: "—",
    partyId: null,
    partyKey: null,
    userId: null,
    invitationId: invitation.id,
    invitationEmail: invitation.email,
    invitationToken: invitation.token ?? null,
    invitationRole: invitation.role,
    invitationExpiresAt: toIso(invitation.expiresAt),
    personEmail: null,
    accountEmail: invitation.email,
    person: null,
    party: null,
    member: null,
  };
}

function peopleOnlyRow(person: ApplicationPersonRow): PeopleAccessRow {
  const companyRoles = peopleAccessCompanyRolesFromPerson(person);
  return {
    key: `people:${person.matchKey}`,
    kind: "people_only",
    name: person.name?.trim() || person.matchKey || "Unnamed",
    companyRoles,
    companyRoleLine: formatPeopleAccessCompanyRoleLine(companyRoles),
    platformAccess: "No access",
    kyc: peopleAccessKycLabel(person),
    aml: peopleAccessAmlLabel(person),
    partyId: null,
    partyKey: person.matchKey || null,
    userId: null,
    invitationId: null,
    invitationEmail: null,
    invitationToken: null,
    invitationRole: null,
    invitationExpiresAt: null,
    personEmail: person.email ?? person.userEmail ?? null,
    accountEmail: null,
    person,
    party: null,
    member: null,
  };
}

export function buildPeopleAccessRows(input: {
  parties: OrganizationPartyProfileDto[];
  people: ApplicationPersonRow[];
  members: PeopleAccessMember[];
  invitations: PeopleAccessInvitation[];
  ownerUserId: string | null;
  now?: Date;
}): { active: PeopleAccessRow[]; inactive: PeopleAccessRow[] } {
  const now = input.now ?? new Date();
  const visiblePeople = filterVisiblePeopleRows(input.people);
  const masterParties = input.parties.filter(
    (party) => party.membershipStatus === "MASTER_ACTIVE" || party.membershipStatus === "MASTER_INACTIVE"
  );
  const activeParties = masterParties.filter((party) => party.membershipStatus === "MASTER_ACTIVE");
  const inactiveParties = masterParties.filter((party) => party.membershipStatus === "MASTER_INACTIVE");

  const matchedKeys = new Set<string>();
  const personForParty = (party: OrganizationPartyProfileDto): ApplicationPersonRow | null => {
    const person = visiblePeople.find((row) => {
      if (!row.matchKey) return false;
      const hit = matchPersonToParty(row, [party]);
      if (hit && row.matchKey) matchedKeys.add(row.matchKey);
      return Boolean(hit);
    });
    return person ?? null;
  };

  const activeCompany = activeParties.map((party) =>
    companyPersonRow({
      party,
      person: personForParty(party),
      ownerUserId: input.ownerUserId,
      members: input.members,
    })
  );

  const linkedUserIds = linkedPartyUserIds(activeParties);
  const emittedUserIds = new Set(
    activeCompany.map((row) => row.userId).filter((id): id is string => Boolean(id))
  );

  const active: PeopleAccessRow[] = [...activeCompany];

  if (input.ownerUserId && isMemberWithoutCompanyRole(input.ownerUserId, linkedUserIds)) {
    const ownerMember = input.members.find((member) => member.id === input.ownerUserId);
    if (ownerMember) {
      active.push(platformOnlyRow({ member: ownerMember, ownerUserId: input.ownerUserId }));
      emittedUserIds.add(ownerMember.id);
    }
  }

  for (const member of input.members) {
    if (!isMemberWithoutCompanyRole(member.id, linkedUserIds)) continue;
    if (emittedUserIds.has(member.id)) continue;
    active.push(platformOnlyRow({ member, ownerUserId: input.ownerUserId }));
    emittedUserIds.add(member.id);
  }

  const unscoped = input.invitations.filter((invitation) => {
    if (invitation.accepted) return false;
    if (invitation.partyProfileId) return false;
    return true;
  });
  for (const invitation of unscoped) {
    active.push(unscopedInviteRow(invitation, now));
  }

  const peopleOnly = visiblePeople.filter(
    (person) =>
      Boolean(person.matchKey) &&
      !matchedKeys.has(person.matchKey) &&
      !matchPersonToParty(person, masterParties) &&
      !isMissingGovernmentIdPerson(person)
  );
  for (const person of peopleOnly) {
    active.push(peopleOnlyRow(person));
  }

  const inactive = inactiveParties.map((party) =>
    companyPersonRow({
      party,
      person: personForParty(party),
      ownerUserId: input.ownerUserId,
      members: input.members,
    })
  );

  return { active, inactive };
}

export function filterPeopleAccessRows(
  rows: PeopleAccessRow[],
  filter: PeopleAccessFilter,
  search: string
): PeopleAccessRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter === "company" && row.kind !== "company_person" && row.kind !== "people_only") {
      return false;
    }
    if (filter === "platform") {
      if (
        row.platformAccess !== "Owner" &&
        row.platformAccess !== "Admin" &&
        row.platformAccess !== "User"
      ) {
        return false;
      }
    }
    if (filter === "pending") {
      if (row.platformAccess !== "Invitation sent" && row.platformAccess !== "Invitation expired") {
        return false;
      }
    }
    if (!q) return true;
    const haystack = [
      row.name,
      row.companyRoleLine,
      row.platformAccess,
      row.personEmail,
      row.accountEmail,
      row.invitationEmail,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function peopleAccessKycBadgeStatus(
  label: PeopleAccessKycLabel
): "neutral" | "in-progress" | "submitted" | "success" | "rejected" | null {
  switch (label) {
    case "—":
      return null;
    case "Not started":
      return "neutral";
    case "In progress":
      return "in-progress";
    case "Pending approval":
      return "submitted";
    case "Approved":
      return "success";
    case "Rejected":
    case "Expired":
      return "rejected";
    default:
      return "neutral";
  }
}

export function peopleAccessAmlBadgeStatus(
  label: PeopleAccessAmlLabel
): "neutral" | "submitted" | "success" | "rejected" | null {
  switch (label) {
    case "—":
      return null;
    case "Not started":
      return "neutral";
    case "Pending":
      return "submitted";
    case "Approved":
      return "success";
    case "Rejected":
      return "rejected";
    default:
      return "neutral";
  }
}

export function peopleAccessPlatformBadgeStatus(
  label: PeopleAccessPlatformLabel
): "active" | "submitted" | "action" | "rejected" | "neutral" | null {
  switch (label) {
    case "Owner":
      return "active";
    case "Admin":
    case "User":
      return "submitted";
    case "Invitation sent":
      return "action";
    case "Invitation expired":
      return "rejected";
    case "No access":
      return "neutral";
    default:
      return null;
  }
}
