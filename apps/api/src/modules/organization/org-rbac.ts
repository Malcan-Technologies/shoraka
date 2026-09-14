import { OrganizationMemberRole } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";

export type OrganizationOwnerAdminGate = {
  owner_user_id: string;
  members: Array<{ user_id: string; role: string }>;
};

export function requireOrganizationOwnerOrAdmin(
  organization: OrganizationOwnerAdminGate,
  userId: string,
  message: string
): void {
  const userMember = organization.members.find(
    (m: { user_id: string; role: string }) => m.user_id === userId
  );
  const canManage =
    organization.owner_user_id === userId ||
    userMember?.role === OrganizationMemberRole.ORGANIZATION_ADMIN;
  if (!canManage) {
    throw new AppError(403, "FORBIDDEN", message);
  }
}
