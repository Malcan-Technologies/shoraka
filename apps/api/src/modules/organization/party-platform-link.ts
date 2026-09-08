import { OrganizationPartyEntityType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";

type Portal = "issuer" | "investor";

/**
 * OrganizationPartyProfile represents company/regulatory identity.
 * OrganizationMember represents platform access.
 *
 * The link between them is OPTIONAL.
 * A director/shareholder does not need a CashSouk account.
 * Do not infer this link from email alone.
 */
export async function assertPartyBelongsToOrganization(params: {
  partyId: string;
  organizationId: string;
  portalType: Portal;
}) {
  const party = await prisma.organizationPartyProfile.findFirst({
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

export async function linkPartyProfileToUser(params: {
  partyId: string;
  userId: string;
  organizationId: string;
  portalType: Portal;
}): Promise<void> {
  const party = await assertPartyBelongsToOrganization({
    partyId: params.partyId,
    organizationId: params.organizationId,
    portalType: params.portalType,
  });
  if (party.user_id && party.user_id !== params.userId) {
    throw new AppError(
      409,
      "PERSON_ALREADY_LINKED",
      "This person is already linked to a different platform account"
    );
  }
  const other = await prisma.organizationPartyProfile.findFirst({
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
  if (party.user_id === params.userId) {
    return;
  }
  await prisma.organizationPartyProfile.update({
    where: { id: params.partyId },
    data: { user_id: params.userId },
  });
}
