import { AdminRole, type AdminRoleKey } from "./admin";

// Admin permission catalog (source of truth).
// Permissions are dotted keys like `module.action` / `module.domain.action`.
export const ADMIN_PERMISSIONS = [
  // Dashboard
  "dashboard.view",
  "dashboard.finance.view",
  "dashboard.operations.view",
  "dashboard.platform.view",

  // Notes
  "notes.view",
  "notes.create",
  "notes.manage",
  "notes.disbursement.manage",
  "notes.repayment.manage",
  "notes.settlement.manage",
  "notes.default.manage",

  // Applications (review + sections)
  "applications.view",
  "applications.manage",
  "applications.financial.manage",
  "applications.company.manage",
  "applications.business_guarantor.manage",
  "applications.documents.manage",
  "applications.contract.manage",
  "applications.invoice.manage",

  // Onboarding
  "onboarding.view",
  "onboarding.manage",

  // Users / Organizations
  "users.view",
  "users.manage",
  "organizations.view",
  "organizations.manage",

  // Roles / Permission Configuration
  "roles.view",
  "roles.manage",

  // Notifications
  "notifications.view",
  "notifications.manage",

  // Audit (read-only)
  "audit.access.view",
  "audit.security.view",
  "audit.document.view",
  "audit.product.view",

  // Document Management (standalone)
  "document_management.view",
  "document_management.manage",

  // Finance / operational panels
  "investments.view",
  "investments.manage",
  "bucket_balances.view",
  "bucket_balances.manage",
  "repayments.view",
  "repayments.manage",
  "disbursements.view",
  "disbursements.manage",
  "service_fee.view",
  "service_fee.manage",

  // Contracts (standalone)
  "contracts.view",
  "contracts.manage",

  // Settings
  "products.view",
  "products.manage",
  "platform_settings.view",
  "platform_settings.manage",

  // Reports
  "reports.view",
  "reports.export",
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
    label: "Roles",
    description: "Manage the admin role catalog, permission matrices, and admin role assignments.",
    permissions: pickPermissions("roles.view", "roles.manage"),
  },
  {
    key: "notificationAdministration",
    label: "Notifications",
    description: "Manage notification types, groups, delivery settings, and logs.",
    permissions: pickPermissions("notifications.view", "notifications.manage"),
  },
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Access dashboard page and widget sections.",
    permissions: pickPermissions(
      "dashboard.view",
      "dashboard.finance.view",
      "dashboard.operations.view",
      "dashboard.platform.view"
    ),
  },
  {
    key: "notes",
    label: "Notes",
    description: "View and manage notes, repayment flows, settlements, and default actions.",
    permissions: pickPermissions(
      "notes.view",
      "notes.create",
      "notes.manage",
      "notes.disbursement.manage",
      "notes.repayment.manage",
      "notes.settlement.manage",
      "notes.default.manage"
    ),
  },
  {
    key: "applications",
    label: "Applications",
    description: "Review applications and manage section workflow actions.",
    permissions: pickPermissions(
      "applications.view",
      "applications.manage",
      "applications.financial.manage",
      "applications.company.manage",
      "applications.business_guarantor.manage",
      "applications.documents.manage",
      "applications.contract.manage",
      "applications.invoice.manage"
    ),
  },
  {
    key: "onboarding",
    label: "Onboarding",
    description: "View and manage onboarding approval queue actions.",
    permissions: pickPermissions("onboarding.view", "onboarding.manage"),
  },
  {
    key: "users",
    label: "Users",
    description: "View and manage admin-user records.",
    permissions: pickPermissions("users.view", "users.manage"),
  },
  {
    key: "organizations",
    label: "Organizations",
    description: "View and manage organizations and related statuses.",
    permissions: pickPermissions("organizations.view", "organizations.manage"),
  },
  {
    key: "audit",
    label: "Audit Logs",
    description: "Read-only access to audit logs.",
    permissions: pickPermissions(
      "audit.access.view",
      "audit.security.view",
      "audit.document.view",
      "audit.product.view"
    ),
  },
  {
    key: "documentManagement",
    label: "Document Management",
    description: "View and manage standalone site documents.",
    permissions: pickPermissions("document_management.view", "document_management.manage"),
  },
  {
    key: "finance",
    label: "Finance",
    description: "View and manage operational finance panels.",
    permissions: pickPermissions(
      "investments.view",
      "investments.manage",
      "bucket_balances.view",
      "bucket_balances.manage",
      "repayments.view",
      "repayments.manage",
      "disbursements.view",
      "disbursements.manage",
      "service_fee.view",
      "service_fee.manage",
      "contracts.view",
      "contracts.manage"
    ),
  },
  {
    key: "settings",
    label: "Product & Platform Settings",
    description: "View and manage products and platform finance settings.",
    permissions: pickPermissions(
      "products.view",
      "products.manage",
      "platform_settings.view",
      "platform_settings.manage"
    ),
  },
  {
    key: "reports",
    label: "Reports",
    description: "View and export reports.",
    permissions: pickPermissions("reports.view", "reports.export"),
  }
];
