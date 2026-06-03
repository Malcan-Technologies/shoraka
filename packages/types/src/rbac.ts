import { AdminRole } from "./admin";

export const ADMIN_PERMISSIONS = [
  "roles.manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const DEFAULT_ADMIN_ROLE_KEYS = [
  AdminRole.SUPER_ADMIN,
  AdminRole.COMPLIANCE_OFFICER,
  AdminRole.OPERATIONS_OFFICER,
  AdminRole.FINANCE_OFFICER,
] as const;

export type DefaultAdminRoleKey = (typeof DEFAULT_ADMIN_ROLE_KEYS)[number];
export type AdminRoleKey = DefaultAdminRoleKey | (string & {});

export const ADMIN_ROLE_CATALOG_REVISION = 3;

export interface AdminRoleTemplate {
  key: AdminRoleKey;
  name: string;
  description: string;
  isSystem: boolean;
  isEditable: boolean;
  isDefault: boolean;
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
  isDefaultRole: boolean;
}

export interface AdminRoleConfigRecord {
  id: string;
  key: AdminRoleKey;
  name: string;
  description: string | null;
  permissions: AdminPermission[];
  isSystem: boolean;
  isEditable: boolean;
  isDefault: boolean;
  memberCount: number;
}

export interface AdminRoleConfigsResponse {
  roles: AdminRoleConfigRecord[];
}

export interface AdminRoleConfigResponse {
  role: AdminRoleConfigRecord;
}

export interface UpdateAdminRolePermissionsInput {
  permissions: AdminPermission[];
}

export const FULL_ACCESS_ADMIN_ROLE_KEYS: AdminRoleKey[] = [AdminRole.SUPER_ADMIN];

const allPermissions = [...ADMIN_PERMISSIONS];

function pickPermissions(...permissions: AdminPermission[]): AdminPermission[] {
  return permissions;
}

export const DEFAULT_ADMIN_ROLE_TEMPLATES: AdminRoleTemplate[] = [
  {
    key: AdminRole.SUPER_ADMIN,
    name: "Super Admin",
    description:
      "Full administrative access to all platform features, role configuration, and sensitive operational controls.",
    isSystem: true,
    isEditable: false,
    isDefault: true,
    permissions: allPermissions,
  },
  {
    key: AdminRole.COMPLIANCE_OFFICER,
    name: "Compliance Officer",
    description:
      "Reviews regulated workflows, investigations, and audit data without managing platform configuration.",
    isSystem: true,
    isEditable: true,
    isDefault: true,
    permissions: [],
  },
  {
    key: AdminRole.OPERATIONS_OFFICER,
    name: "Operations Officer",
    description:
      "Runs daily platform operations across users, organizations, financing workflows, and notes.",
    isSystem: true,
    isEditable: true,
    isDefault: true,
    permissions: [],
  },
  {
    key: AdminRole.FINANCE_OFFICER,
    name: "Finance Officer",
    description:
      "Monitors financing operations and financial controls, including disbursement actions and related records.",
    isSystem: true,
    isEditable: true,
    isDefault: true,
    permissions: [],
  },
];

export const ADMIN_PERMISSION_GROUPS: AdminPermissionGroup[] = [
  {
    key: "roleAdministration",
    label: "Role Administration",
    description: "Manage the admin role catalog, permission matrices, and admin role assignments.",
    permissions: pickPermissions("roles.manage"),
  },
];
