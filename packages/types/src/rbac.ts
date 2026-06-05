import { AdminRole, type AdminRoleKey } from "./admin";

export const ADMIN_PERMISSIONS = [
  "roles.manage",
  "notifications.manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminRoleBadgeColor = `#${string}`;

export const DEFAULT_ADMIN_ROLE_BADGE_COLOR: AdminRoleBadgeColor = "#475569";
export const SUPER_ADMIN_BADGE_COLOR: AdminRoleBadgeColor = "#DC2626";

export const SYSTEM_ADMIN_ROLE_KEYS = [AdminRole.SUPER_ADMIN] as const;

export interface SystemAdminRoleTemplate {
  key: AdminRoleKey;
  name: string;
  description: string;
  badgeColor: AdminRoleBadgeColor;
  isSystem: boolean;
  isEditable: boolean;
  permissions: AdminPermission[];
}

export interface AdminPermissionGroup {
  key: string;
  label: string;
  description: string;
  permissions: AdminPermission[];
}

export interface ResolvedAdminAccess {
  roleKey: AdminRoleKey;
  roleName: string;
  description: string | null;
  permissions: AdminPermission[];
  isSuperAdmin: boolean;
  isSystemRole: boolean;
  isEditable: boolean;
}

export interface AdminRoleConfigRecord {
  id: string;
  key: AdminRoleKey;
  name: string;
  description: string | null;
  badgeColor: AdminRoleBadgeColor;
  permissions: AdminPermission[];
  isSystem: boolean;
  isEditable: boolean;
  memberCount: number;
}

export interface AdminRoleConfigsResponse {
  roles: AdminRoleConfigRecord[];
}

export interface AdminRoleConfigResponse {
  role: AdminRoleConfigRecord;
}

export interface CreateAdminRoleInput {
  key: AdminRoleKey;
  name: string;
  description?: string;
  badgeColor: AdminRoleBadgeColor;
}

export interface UpdateAdminRolePermissionsInput {
  permissions: AdminPermission[];
  badgeColor: AdminRoleBadgeColor;
}

export const FULL_ACCESS_ADMIN_ROLE_KEYS: AdminRoleKey[] = [AdminRole.SUPER_ADMIN];

const allPermissions = [...ADMIN_PERMISSIONS];

function pickPermissions(...permissions: AdminPermission[]): AdminPermission[] {
  return permissions;
}

export const SUPER_ADMIN_ROLE_TEMPLATE: SystemAdminRoleTemplate = {
  key: AdminRole.SUPER_ADMIN,
  name: "Super Admin",
  description:
    "Full administrative access to all platform features, role configuration, and sensitive operational controls.",
  badgeColor: SUPER_ADMIN_BADGE_COLOR,
  isSystem: true,
  isEditable: false,
  permissions: allPermissions,
};

export const ADMIN_PERMISSION_GROUPS: AdminPermissionGroup[] = [
  {
    key: "roleAdministration",
    label: "Role Administration",
    description: "Manage the admin role catalog, permission matrices, and admin role assignments.",
    permissions: pickPermissions("roles.manage"),
  },
  {
    key: "notificationAdministration",
    label: "Notification Administration",
    description: "Manage the notification system, including notification types, groups, and logs.",
    permissions: pickPermissions("notifications.manage"),
  }
];
