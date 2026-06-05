import type { Admin, AdminRoleConfig, PrismaClient } from "@prisma/client";
import {
  ADMIN_PERMISSIONS,
  FULL_ACCESS_ADMIN_ROLE_KEYS,
  SUPER_ADMIN_ROLE_TEMPLATE,
  type AdminPermission,
  type AdminRoleKey,
  type ResolvedAdminAccess,
} from "@cashsouk/types";

const validPermissions = new Set<string>(ADMIN_PERMISSIONS);
let syncPromise: Promise<void> | null = null;

type AdminWithRoleConfig = Pick<Admin, "id" | "role_id" | "role_description"> & {
  role?: AdminRoleConfig | null;
};

function sanitizePermissions(permissions: string[]): AdminPermission[] {
  return permissions.filter((permission): permission is AdminPermission =>
    validPermissions.has(permission)
  );
}

function toResolvedAccess(
  role: Pick<
    AdminRoleConfig,
    "key" | "name" | "description" | "permissions" | "is_system" | "is_editable" | "is_default"
  >
): ResolvedAdminAccess {
  const isSuperAdmin = FULL_ACCESS_ADMIN_ROLE_KEYS.includes(role.key as AdminRoleKey);
  const permissions = isSuperAdmin ? [...ADMIN_PERMISSIONS] : sanitizePermissions(role.permissions);
  const isSystemRole = role.key === SUPER_ADMIN_ROLE_TEMPLATE.key;

  return {
    roleKey: role.key as AdminRoleKey,
    roleName: role.name,
    description: role.description ?? null,
    permissions,
    isSuperAdmin,
    isSystemRole,
    isEditable: !isSystemRole,
  };
}

async function syncSuperAdminRole(prisma: PrismaClient): Promise<void> {
  await prisma.adminRoleConfig.upsert({
    where: { key: SUPER_ADMIN_ROLE_TEMPLATE.key },
    create: {
      key: SUPER_ADMIN_ROLE_TEMPLATE.key,
      name: SUPER_ADMIN_ROLE_TEMPLATE.name,
      description: SUPER_ADMIN_ROLE_TEMPLATE.description,
      badge_color: SUPER_ADMIN_ROLE_TEMPLATE.badgeColor,
      permissions: SUPER_ADMIN_ROLE_TEMPLATE.permissions,
      is_system: true,
      is_editable: false,
      is_default: false,
    },
    update: {
      name: SUPER_ADMIN_ROLE_TEMPLATE.name,
      description: SUPER_ADMIN_ROLE_TEMPLATE.description,
      permissions: SUPER_ADMIN_ROLE_TEMPLATE.permissions,
      is_system: true,
      is_editable: false,
      // The legacy column still exists, but the product no longer models default roles.
      is_default: false,
    },
  });
}

export async function ensureAdminRoleCatalog(prisma: PrismaClient): Promise<void> {
  if (!syncPromise) {
    syncPromise = syncSuperAdminRole(prisma).finally(() => {
      syncPromise = null;
    });
  }

  await syncPromise;
}

export async function resolveAdminAccess(
  prisma: PrismaClient,
  admin: AdminWithRoleConfig
): Promise<ResolvedAdminAccess> {
  await ensureAdminRoleCatalog(prisma);

  const roleConfig =
    admin.role ??
    (admin.role_id
      ? await prisma.adminRoleConfig.findUnique({
          where: { id: admin.role_id },
        })
      : null) ??
    (admin.role_description
      ? await prisma.adminRoleConfig.findUnique({
          where: { key: admin.role_description },
        })
      : null);

  if (roleConfig) {
    return toResolvedAccess(roleConfig);
  }

  throw new Error(`Unable to resolve admin RBAC role for admin ${admin.id}`);
}
