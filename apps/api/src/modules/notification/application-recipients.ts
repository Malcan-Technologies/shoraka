import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";

/**
 * Resolve issuer notification recipients for an application:
 * - Organization owner
 * - Organization members in OWNER or ORGANIZATION_ADMIN roles
 */
export async function getIssuerRecipientUserIdsForApplication(
  applicationId: string
): Promise<string[]> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      issuer_organization: {
        select: {
          owner_user_id: true,
          id: true,
        },
      },
    },
  });

  const ownerUserId = application?.issuer_organization?.owner_user_id;
  const issuerOrganizationId = application?.issuer_organization?.id;
  if (!ownerUserId || !issuerOrganizationId) {
    return [];
  }

  const adminMembers = await prisma.organizationMember.findMany({
    where: {
      issuer_organization_id: issuerOrganizationId,
      role: {
        in: [OrganizationMemberRole.OWNER, OrganizationMemberRole.ORGANIZATION_ADMIN],
      },
    },
    select: {
      user_id: true,
    },
  });

  const recipientIds = new Set<string>([ownerUserId]);
  for (const member of adminMembers) {
    recipientIds.add(member.user_id);
  }

  return Array.from(recipientIds);
}
