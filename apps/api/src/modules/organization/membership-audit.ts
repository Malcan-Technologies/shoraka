import { UserRole } from "@prisma/client";
import { createOnboardingLogRow, AccountAuditDb } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import { snapshotBusinessReference } from "../../lib/audit/display-references";

export const ORGANIZATION_MEMBERSHIP_EVENT = {
  MEMBER_ADDED: "MEMBER_ADDED",
  MEMBER_INVITED: "MEMBER_INVITED",
  MEMBER_REMOVED: "MEMBER_REMOVED",
  MEMBER_ROLE_CHANGED: "MEMBER_ROLE_CHANGED",
} as const;

export type OrganizationMembershipEventType =
  (typeof ORGANIZATION_MEMBERSHIP_EVENT)[keyof typeof ORGANIZATION_MEMBERSHIP_EVENT];

export async function logOrganizationMembershipEvent(params: {
  eventType: OrganizationMembershipEventType;
  actorUserId: string;
  ownerUserId: string;
  organizationId: string;
  portalType: "investor" | "issuer";
  organizationName?: string | null;
  organizationReference?: string | null;
  memberUserId?: string | null;
  memberEmail?: string | null;
  previousRole?: string | null;
  newRole?: string | null;
  invitationId?: string | null;
  db?: AccountAuditDb;
}): Promise<void> {
  const organizationReference = snapshotBusinessReference(
    params.organizationReference,
    params.organizationId
  );
  const subjectUserId = params.memberUserId || params.ownerUserId;
  await createOnboardingLogRow(
    {
      userId: subjectUserId,
      actorUserId: params.actorUserId,
      role: params.portalType === "investor" ? UserRole.INVESTOR : UserRole.ISSUER,
      eventType: params.eventType,
      portal: params.portalType,
      organizationName: params.organizationName ?? undefined,
      investorOrganizationId: params.portalType === "investor" ? params.organizationId : null,
      issuerOrganizationId: params.portalType === "issuer" ? params.organizationId : null,
      metadata: {
        action: params.eventType,
        organizationId: params.organizationId,
        ...(organizationReference ? { organizationReference } : {}),
        ...(params.memberUserId ? { memberUserId: params.memberUserId } : {}),
        ...(params.memberEmail ? { memberEmail: params.memberEmail } : {}),
        ...(params.previousRole ? { previousRole: params.previousRole } : {}),
        ...(params.newRole ? { newRole: params.newRole } : {}),
        ...(params.invitationId ? { invitationId: params.invitationId } : {}),
      },
    },
    params.db ?? prisma
  );
}
