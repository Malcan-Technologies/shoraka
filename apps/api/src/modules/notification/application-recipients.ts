import { prisma } from "../../lib/prisma";
import { listIssuerOrgMemberUserIds } from "./org-member-recipients";

/**
 * Resolve issuer notification recipients for an application:
 * - All issuer organization users (Owner + Org Admin + normal members)
 */
export async function getIssuerRecipientUserIdsForApplication(
  applicationId: string
): Promise<string[]> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      issuer_organization: {
        select: { id: true },
      },
    },
  });

  const issuerOrganizationId = application?.issuer_organization?.id;
  if (!issuerOrganizationId) {
    return [];
  }

  return listIssuerOrgMemberUserIds(issuerOrganizationId);
}
