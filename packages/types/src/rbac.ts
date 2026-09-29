import { AdminRole, type AdminRoleKey } from "./admin";

// Admin permission catalog (source of truth).
// Permissions are dotted keys like `module.action` / `module.domain.action`.
export const ADMIN_PERMISSIONS = [
  // Dashboard
  "dashboard.view",
  "dashboard.finance.view",
  "dashboard.operations.view",
  "dashboard.platform.view",
  "dashboard.reports.view",

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
  "applications.offer_acceptance.manage",

  // Onboarding
  "onboarding.view",
  "onboarding.manage",

  // User Accounts / Issuers & Investors
  "users.view",
  "users.manage",
  "organizations.view",
  "organizations.manage",

  // Paymaster master (legal customer / obligor)
  "paymasters.view",
  "paymasters.manage",

  // Roles / Permission Configuration
  "roles.view",
  "roles.manage",

  // Notifications
  "notifications.view",
  "notifications.manage",

  // Audit (read-only)
  "audit.access.view",
  "audit.security.view",
  "audit.product.view",
  "audit.legal_documents.view",
  "audit.legal_acceptances.view",
  "audit.external_acceptances.view",
  "audit.notifications.view",

  // Legal Documents / Legal Acceptances
  "document_management.view",
  "document_management.manage",

  // Finance / operational panels
  "investments.view",
  "bucket_balances.view",
  "repayments.view",
  "disbursements.view",
  "settlements.view",
  "investor_withdrawals.view",
  "investor_withdrawals.manage",
  "gateway_payments.view",
  "gateway_payments.manage",
  "gateway_reconciliation.view",
  "gateway_reconciliation.manage",

  // Facilities (standalone)
  "contracts.view",
  "contracts.manage",

  // Settings
  "products.view",
  "products.manage",
  // Platform Finance settings only (fees, investment limits, offer deadlines, trustee letter, money flow accounts)
  "platform_settings.view",
  "platform_settings.manage",
  // Shoraka / Company (operator) profile
  "operator_profile.view",
  "operator_profile.manage",

  "reports.view",

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

// Ordered to match the admin sidebar: top items, Lifecycle, Finance, Directory, Settings.
export const ADMIN_PERMISSION_GROUPS: AdminPermissionGroup[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "View Dashboard summary cards and queues.",
    permissions: pickPermissions(
      "dashboard.view",
      "dashboard.finance.view",
      "dashboard.operations.view",
      "dashboard.platform.view",
      "dashboard.reports.view"
    ),
  },
  {
    key: "reports",
    label: "Reports",
    description: "View and export report data.",
    permissions: pickPermissions("reports.view"),
  },
  {
    key: "audit",
    label: "Audit Logs",
    description: "View audit logs and audit evidence.",
    permissions: pickPermissions(
      "audit.access.view",
      "audit.security.view",
      "audit.product.view",
      "audit.legal_documents.view",
      "audit.legal_acceptances.view",
      "audit.external_acceptances.view",
      "audit.notifications.view"
    ),
  },
  {
    key: "onboarding",
    label: "Onboarding",
    description: "View onboarding records and manage approval actions.",
    permissions: pickPermissions("onboarding.view", "onboarding.manage"),
  },
  {
    key: "applications",
    label: "Applications",
    description: "View applications and manage review actions.",
    permissions: pickPermissions(
      "applications.view",
      "applications.manage",
      "applications.financial.manage",
      "applications.company.manage",
      "applications.business_guarantor.manage",
      "applications.documents.manage",
      "applications.offer_acceptance.manage"
    ),
  },
  {
    key: "contracts",
    label: "Facilities",
    description: "View facilities and manage facility actions.",
    permissions: pickPermissions("contracts.view", "contracts.manage"),
  },
  {
    key: "notes",
    label: "Notes",
    description: "View notes and manage note actions.",
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
    key: "finance",
    label: "Finance",
    description: "View finance queues and manage finance actions.",
    permissions: pickPermissions(
      "investments.view",
      "bucket_balances.view",
      "repayments.view",
      "disbursements.view",
      "settlements.view",
      "investor_withdrawals.view",
      "investor_withdrawals.manage",
      "gateway_payments.view",
      "gateway_payments.manage",
      "gateway_reconciliation.view",
      "gateway_reconciliation.manage"
    ),
  },
  {
    key: "users",
    label: "User Accounts",
    description: "View users and manage user access.",
    permissions: pickPermissions("users.view", "users.manage"),
  },
  {
    key: "organizations",
    label: "Issuers & Investors",
    description: "View organizations and manage organization actions.",
    permissions: pickPermissions("organizations.view", "organizations.manage"),
  },
  {
    key: "paymasters",
    label: "Paymasters",
    description: "View Paymasters and manage verification actions.",
    permissions: pickPermissions("paymasters.view", "paymasters.manage"),
  },
  {
    key: "documentManagement",
    label: "Legal Documents",
    description: "View legal documents and manage document versions.",
    permissions: pickPermissions("document_management.view", "document_management.manage"),
  },
  {
    key: "operatorProfile",
    label: "Operator Profile",
    description: "View and manage the Shoraka / Company profile.",
    permissions: pickPermissions("operator_profile.view", "operator_profile.manage"),
  },
  {
    key: "products",
    label: "Products",
    description: "View products and manage product workflows.",
    permissions: pickPermissions("products.view", "products.manage"),
  },
  {
    key: "platformFinance",
    label: "Platform Finance Settings",
    description: "View and manage Platform Finance settings.",
    permissions: pickPermissions("platform_settings.view", "platform_settings.manage"),
  },
  {
    key: "notificationAdministration",
    label: "Notifications",
    description: "View notifications and manage notification settings.",
    permissions: pickPermissions("notifications.view", "notifications.manage"),
  },
  {
    key: "roleAdministration",
    label: "Roles",
    description: "View roles and manage role access.",
    permissions: pickPermissions("roles.view", "roles.manage"),
  },
];
