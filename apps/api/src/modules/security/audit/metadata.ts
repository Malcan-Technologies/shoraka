import { z } from "zod";
import { SECURITY_AUDIT_EVENTS, type SecurityAuditEventType } from "./events";

const snapshotFields = {
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
};

const jsonValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
]);

const profileMetadataSchema = z.object({
  ...snapshotFields,
  changedFields: z.array(z.string()),
  before: z.record(jsonValue),
  after: z.record(jsonValue),
});

const roleUpdateMetadataSchema = z.object({
  ...snapshotFields,
  previousRoles: z.array(z.string()),
  newRoles: z.array(z.string()),
  addedRoles: z.array(z.string()),
  removedRoles: z.array(z.string()),
  addedRole: z.string().optional(),
});

const activeRoleMetadataSchema = z.object({
  ...snapshotFields,
  previousRole: z.string().nullable(),
  newRole: z.string(),
  sessionId: z.string().nullable().optional(),
});

const passwordChangedMetadataSchema = z.object({
  ...snapshotFields,
  reason: z.string().optional(),
  sessionRevoked: z.boolean().optional(),
});

const passwordFailedMetadataSchema = z.object({
  ...snapshotFields,
  reasonCode: z.string(),
  providerErrorCode: z.string().nullable().optional(),
});

const emailVerificationMetadataSchema = z.object({
  ...snapshotFields,
  email: z.string(),
  reasonCode: z.string(),
});

const accessDeniedMetadataSchema = z.object({
  ...snapshotFields,
  permission: z.string().optional(),
  requiredPermissions: z.array(z.string()).optional(),
  method: z.string(),
  path: z.string(),
  reasonCode: z.string(),
});

const adminRoleCreatedMetadataSchema = z.object({
  ...snapshotFields,
  roleKey: z.string(),
  roleName: z.string(),
  badgeColor: z.string().optional(),
});

const adminRolePermissionsMetadataSchema = z.object({
  ...snapshotFields,
  roleKey: z.string(),
  roleName: z.string(),
  addedPermissions: z.array(z.string()),
  removedPermissions: z.array(z.string()),
  previousPermissions: z.array(z.string()).optional(),
  nextPermissions: z.array(z.string()).optional(),
  previousBadgeColor: z.string().nullable().optional(),
  nextBadgeColor: z.string().nullable().optional(),
});

const adminRoleDeletedMetadataSchema = z.object({
  ...snapshotFields,
  roleKey: z.string(),
  roleName: z.string(),
});

const adminUserRoleChangedMetadataSchema = z.object({
  ...snapshotFields,
  previousRole: z.string().nullable(),
  newRole: z.string(),
});

const adminStatusMetadataSchema = z.object({
  ...snapshotFields,
  previousStatus: z.string(),
  newStatus: z.string(),
  previousRoles: z.array(z.string()).optional(),
  newRoles: z.array(z.string()).optional(),
});

const invitationMetadataSchema = z.object({
  ...snapshotFields,
  invitationId: z.string(),
  email: z.string(),
  role: z.string(),
  expiresAt: z.string().nullable().optional(),
  emailSent: z.boolean().optional(),
});

const publicIdMetadataSchema = z.object({
  ...snapshotFields,
  previousUserId: z.string(),
  newUserId: z.string(),
});

const membershipMetadataSchema = z.object({
  ...snapshotFields,
  memberUserId: z.string().nullable().optional(),
  memberEmail: z.string().nullable().optional(),
  previousRole: z.string().nullable().optional(),
  newRole: z.string().nullable().optional(),
  invitationId: z.string().optional(),
  email: z.string().optional(),
  role: z.string().optional(),
  expiresAt: z.string().nullable().optional(),
  previousOwnerUserId: z.string().optional(),
  newOwnerUserId: z.string().optional(),
});

const notificationTypeMetadataSchema = z.object({
  ...snapshotFields,
  notificationTypeId: z.string(),
  changedFields: z.array(z.string()),
  before: z.record(jsonValue),
  after: z.record(jsonValue),
});

const notificationPreferenceMetadataSchema = z.object({
  ...snapshotFields,
  notificationTypeId: z.string(),
  before: z.record(jsonValue),
  after: z.record(jsonValue),
});

const notificationGroupMetadataSchema = z.object({
  ...snapshotFields,
  groupId: z.string(),
  name: z.string(),
  userCount: z.number().int().min(0),
});

const metadataByEvent = {
  USER_ROLE_ADDED: roleUpdateMetadataSchema,
  ACTIVE_ROLE_CHANGED: activeRoleMetadataSchema,
  USER_PROFILE_UPDATED: profileMetadataSchema,
  USER_PROFILE_UPDATED_BY_ADMIN: profileMetadataSchema,
  PASSWORD_CHANGED: passwordChangedMetadataSchema,
  PASSWORD_CHANGE_FAILED: passwordFailedMetadataSchema,
  USER_EMAIL_VERIFIED: emailVerificationMetadataSchema,
  EMAIL_VERIFICATION_FAILED: emailVerificationMetadataSchema,
  ADMIN_ACCESS_DENIED: accessDeniedMetadataSchema,
  ADMIN_ROLE_CREATED: adminRoleCreatedMetadataSchema,
  ADMIN_ROLE_PERMISSIONS_UPDATED: adminRolePermissionsMetadataSchema,
  ADMIN_ROLE_DELETED: adminRoleDeletedMetadataSchema,
  USER_ROLES_UPDATED: roleUpdateMetadataSchema,
  ADMIN_USER_ROLE_CHANGED: adminUserRoleChangedMetadataSchema,
  ADMIN_USER_DEACTIVATED: adminStatusMetadataSchema,
  ADMIN_USER_REACTIVATED: adminStatusMetadataSchema,
  ADMIN_INVITATION_CREATED: invitationMetadataSchema,
  ADMIN_INVITATION_LINK_GENERATED: invitationMetadataSchema,
  ADMIN_INVITATION_RESENT: invitationMetadataSchema,
  ADMIN_INVITATION_REVOKED: invitationMetadataSchema,
  ADMIN_INVITATION_ACCEPTED: invitationMetadataSchema,
  USER_PUBLIC_ID_CHANGED: publicIdMetadataSchema,
  ORGANIZATION_MEMBER_INVITED: membershipMetadataSchema,
  ORGANIZATION_MEMBER_JOINED: membershipMetadataSchema,
  ORGANIZATION_MEMBER_REMOVED: membershipMetadataSchema,
  ORGANIZATION_MEMBER_LEFT: membershipMetadataSchema,
  ORGANIZATION_MEMBER_ROLE_UPDATED: membershipMetadataSchema,
  ORGANIZATION_OWNERSHIP_TRANSFERRED: membershipMetadataSchema,
  ORGANIZATION_INVITATION_REVOKED: membershipMetadataSchema,
  ORGANIZATION_INVITATION_RESENT: membershipMetadataSchema,
  NOTIFICATION_TYPE_UPDATED: notificationTypeMetadataSchema,
  NOTIFICATION_GROUP_CREATED: notificationGroupMetadataSchema,
  NOTIFICATION_GROUP_UPDATED: notificationGroupMetadataSchema,
  NOTIFICATION_GROUP_DELETED: notificationGroupMetadataSchema,
  USER_NOTIFICATION_PREFERENCE_UPDATED: notificationPreferenceMetadataSchema,
} as const satisfies Record<SecurityAuditEventType, z.ZodType>;

export function parseSecurityAuditMetadata(eventType: SecurityAuditEventType, metadata: unknown) {
  return metadataByEvent[eventType].parse(metadata);
}

export function isSecurityAuditEventType(value: string): value is SecurityAuditEventType {
  return (SECURITY_AUDIT_EVENTS as readonly string[]).includes(value);
}
