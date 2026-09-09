import {
  OrganizationMemberRole,
  OrganizationPartyEntityType,
  OrganizationPartyMembershipStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";

type Portal = "issuer" | "investor";
type PartyDb = typeof prisma | Prisma.TransactionClient;

/**
 * OrganizationPartyProfile.user_id is a durable identity link,
 * not an access grant.
 *
 * Removing OrganizationMember must not clear this field.
 * OrganizationMember controls current portal access.
 *
 * Never overwrite an existing different user_id during invitation
 * acceptance. Person-scoped acceptance must be transactional.
 *
 * OrganizationPartyProfile represents company/regulatory identity.
 * OrganizationMember represents platform access.
 *
 * The link between them is OPTIONAL.
 * A director/shareholder does not need a CashSouk account.
 * Do not infer this link from email alone.
 */
export function isPlaceholderInvitationEmail(email: string): boolean {
  return email.startsWith("invitation-") && email.includes("@cashsouk.com");
}

/**
 * Generic organization invite links may be claimable by an authenticated user,
 * but a Person-scoped invite assigns a regulatory/company identity.
 * An unlinked Person must therefore not be claimable through an unrestricted
 * placeholder invitation.
 */
export function assertPersonScopedPlaceholderAllowed(params: {
  invitationEmail: string;
  partyUserId: string | null;
  acceptingUserId: string;
}): void {
  if (!isPlaceholderInvitationEmail(params.invitationEmail)) {
    return;
  }
  if (!params.partyUserId) {
    throw new AppError(
      400,
      "PERSON_INVITE_REQUIRES_EMAIL",
      "This person invitation cannot be claimed with a link-only placeholder"
    );
  }
  if (params.partyUserId !== params.acceptingUserId) {
    throw new AppError(
      409,
      "PERSON_ALREADY_LINKED",
      "This person is already linked to a different platform account"
    );
  }
}

export function assertPartyActiveForPlatformInvite(party: {
  membership_status: OrganizationPartyMembershipStatus;
}): void {
  if (party.membership_status !== OrganizationPartyMembershipStatus.MASTER_ACTIVE) {
    throw new AppError(
      400,
      "PERSON_INACTIVE",
      "Inactive people cannot be invited or restored to platform access"
    );
  }
}

export async function assertPartyBelongsToOrganization(params: {
  partyId: string;
  organizationId: string;
  portalType: Portal;
  db?: PartyDb;
}) {
  const db = params.db ?? prisma;
  const party = await db.organizationPartyProfile.findFirst({
    where:
      params.portalType === "issuer"
        ? { id: params.partyId, issuer_organization_id: params.organizationId }
        : { id: params.partyId, investor_organization_id: params.organizationId },
    include: {
      user: { select: { user_id: true, email: true } },
    },
  });
  if (!party) {
    throw new AppError(404, "NOT_FOUND", "Person not found in this organization");
  }
  if (party.entity_type === OrganizationPartyEntityType.CORPORATE) {
    throw new AppError(
      400,
      "CORPORATE_PARTY",
      "A company shareholder cannot be invited as a platform user"
    );
  }
  return party;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Atomically set Person.user_id only when it is null or already the accepting User.
 * Never overwrites P1.user_id = U1 with U2.
 */
export async function claimPartyProfileUserLink(params: {
  partyId: string;
  userId: string;
  organizationId: string;
  portalType: Portal;
  db?: PartyDb;
}): Promise<"created" | "unchanged"> {
  const db = params.db ?? prisma;
  const party = await assertPartyBelongsToOrganization({
    partyId: params.partyId,
    organizationId: params.organizationId,
    portalType: params.portalType,
    db,
  });
  if (party.user_id && party.user_id !== params.userId) {
    throw new AppError(
      409,
      "PERSON_ALREADY_LINKED",
      "This person is already linked to a different platform account"
    );
  }
  const other = await db.organizationPartyProfile.findFirst({
    where:
      params.portalType === "issuer"
        ? {
            issuer_organization_id: params.organizationId,
            user_id: params.userId,
            NOT: { id: params.partyId },
          }
        : {
            investor_organization_id: params.organizationId,
            user_id: params.userId,
            NOT: { id: params.partyId },
          },
    select: { id: true },
  });
  if (other) {
    throw new AppError(
      409,
      "USER_ALREADY_LINKED",
      "This platform account is already linked to another person in this organization"
    );
  }
  const alreadyLinked = party.user_id === params.userId;
  try {
    const result = await db.organizationPartyProfile.updateMany({
      where: {
        id: params.partyId,
        OR: [{ user_id: null }, { user_id: params.userId }],
      },
      data: { user_id: params.userId },
    });
    if (result.count !== 1) {
      throw new AppError(
        409,
        "PERSON_ALREADY_LINKED",
        "This person is already linked to a different platform account"
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new AppError(
        409,
        "USER_ALREADY_LINKED",
        "This platform account is already linked to another person in this organization"
      );
    }
    throw error;
  }
  return alreadyLinked ? "unchanged" : "created";
}

export async function linkPartyProfileToUser(params: {
  partyId: string;
  userId: string;
  organizationId: string;
  portalType: Portal;
  db?: PartyDb;
}): Promise<"created" | "unchanged"> {
  return claimPartyProfileUserLink(params);
}

export async function applyPersonScopedInvitationAcceptance(params: {
  db: PartyDb;
  partyId: string;
  organizationId: string;
  portalType: Portal;
  acceptingUserId: string;
  invitationId: string;
  invitationRole: OrganizationMemberRole;
  placeholderEmailUpdate?: string;
}): Promise<{ link: "created" | "unchanged"; membershipCreated: boolean }> {
  const party = await assertPartyBelongsToOrganization({
    partyId: params.partyId,
    organizationId: params.organizationId,
    portalType: params.portalType,
    db: params.db,
  });
  assertPartyActiveForPlatformInvite(party);
  if (party.user_id && party.user_id !== params.acceptingUserId) {
    throw new AppError(
      409,
      "PERSON_ALREADY_LINKED",
      "This person is already linked to a different platform account"
    );
  }

  const link = await claimPartyProfileUserLink({
    partyId: params.partyId,
    userId: params.acceptingUserId,
    organizationId: params.organizationId,
    portalType: params.portalType,
    db: params.db,
  });

  const memberWhere =
    params.portalType === "issuer"
      ? {
          issuer_organization_id: params.organizationId,
          user_id: params.acceptingUserId,
        }
      : {
          investor_organization_id: params.organizationId,
          user_id: params.acceptingUserId,
        };
  const existingMember = await params.db.organizationMember.findFirst({
    where: memberWhere,
    select: { id: true },
  });
  let membershipCreated = false;
  if (!existingMember) {
    await params.db.organizationMember.create({
      data:
        params.portalType === "issuer"
          ? {
              user_id: params.acceptingUserId,
              issuer_organization_id: params.organizationId,
              role: params.invitationRole,
            }
          : {
              user_id: params.acceptingUserId,
              investor_organization_id: params.organizationId,
              role: params.invitationRole,
            },
    });
    membershipCreated = true;
  }

  const invitationData = {
    accepted: true,
    accepted_at: new Date(),
    ...(params.placeholderEmailUpdate ? { email: params.placeholderEmailUpdate } : {}),
  };
  const invitationWhere = {
    id: params.invitationId,
    accepted: false,
    expires_at: { gt: new Date() },
  };
  const invitationUpdate =
    params.portalType === "investor"
      ? await params.db.investorOrganizationInvitation.updateMany({
          where: invitationWhere,
          data: invitationData,
        })
      : await params.db.issuerOrganizationInvitation.updateMany({
          where: invitationWhere,
          data: invitationData,
        });
  if (invitationUpdate.count !== 1) {
    throw new AppError(400, "ALREADY_ACCEPTED", "This invitation has already been accepted");
  }

  return { link, membershipCreated };
}
