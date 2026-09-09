/**
 * OrganizationPartyProfile represents company/regulatory identity.
 * OrganizationMember represents platform access.
 *
 * The link between them is OPTIONAL.
 * A director/shareholder does not need a CashSouk account.
 * Do not infer this link from email alone.
 */
export type PersonPlatformAccessStatus =
  | "NOT_INVITED"
  | "INVITATION_PENDING"
  | "INVITATION_EXPIRED"
  | "NO_PLATFORM_ACCESS"
  | "ORGANIZATION_MEMBER"
  | "ORGANIZATION_ADMIN";

export type PersonPlatformAccess = {
  status: PersonPlatformAccessStatus;
  label: string;
  memberRole: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER" | null;
  invitationId: string | null;
  invitationExpiresAt: string | null;
};

export type PersonPlatformAccessMember = {
  userId: string;
  role: string;
};

export type PersonPlatformAccessInvitation = {
  id: string;
  partyProfileId: string | null;
  accepted: boolean;
  expiresAt: string | Date;
};

const ACCESS_LABEL: Record<PersonPlatformAccessStatus, string> = {
  NOT_INVITED: "Not invited",
  INVITATION_PENDING: "Invitation pending",
  INVITATION_EXPIRED: "Invitation expired",
  NO_PLATFORM_ACCESS: "No platform access",
  ORGANIZATION_MEMBER: "Organization Member",
  ORGANIZATION_ADMIN: "Organization Admin",
};

function emptyAccess(status: PersonPlatformAccessStatus): PersonPlatformAccess {
  return {
    status,
    label: ACCESS_LABEL[status],
    memberRole: null,
    invitationId: null,
    invitationExpiresAt: null,
  };
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function resolvePersonPlatformAccess(input: {
  linkedUserId: string | null;
  members: PersonPlatformAccessMember[];
  invitations: PersonPlatformAccessInvitation[];
  partyId: string;
  now?: Date;
}): PersonPlatformAccess {
  const linkedUserId = input.linkedUserId;
  if (linkedUserId) {
    const member = input.members.find((row) => row.userId === linkedUserId);
    if (member) {
      const admin =
        member.role === "ORGANIZATION_ADMIN" || member.role === "OWNER";
      const status: PersonPlatformAccessStatus = admin
        ? "ORGANIZATION_ADMIN"
        : "ORGANIZATION_MEMBER";
      return {
        status,
        label: ACCESS_LABEL[status],
        memberRole: admin ? "ORGANIZATION_ADMIN" : "ORGANIZATION_MEMBER",
        invitationId: null,
        invitationExpiresAt: null,
      };
    }
    return emptyAccess("NO_PLATFORM_ACCESS");
  }

  const now = input.now ?? new Date();
  const partyInvites = input.invitations.filter(
    (row) => !row.accepted && row.partyProfileId === input.partyId
  );
  const pending = partyInvites
    .filter((row) => new Date(row.expiresAt) > now)
    .sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime());
  if (pending[0]) {
    return {
      status: "INVITATION_PENDING",
      label: ACCESS_LABEL.INVITATION_PENDING,
      memberRole: null,
      invitationId: pending[0].id,
      invitationExpiresAt: toIso(pending[0].expiresAt),
    };
  }
  const expired = partyInvites
    .filter((row) => new Date(row.expiresAt) <= now)
    .sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime());
  if (expired[0]) {
    return {
      status: "INVITATION_EXPIRED",
      label: ACCESS_LABEL.INVITATION_EXPIRED,
      memberRole: null,
      invitationId: expired[0].id,
      invitationExpiresAt: toIso(expired[0].expiresAt),
    };
  }
  return emptyAccess("NOT_INVITED");
}

export function personPlatformAccessLabel(status: PersonPlatformAccessStatus): string {
  return ACCESS_LABEL[status];
}

export function linkedPartyUserIds(parties: Array<{ userId?: string | null }>): Set<string> {
  return new Set(
    parties
      .map((party) => party.userId)
      .filter((userId): userId is string => Boolean(userId))
  );
}

export function isMemberWithoutCompanyRole(
  memberUserId: string,
  linkedUserIds: Set<string>
): boolean {
  return !linkedUserIds.has(memberUserId);
}
