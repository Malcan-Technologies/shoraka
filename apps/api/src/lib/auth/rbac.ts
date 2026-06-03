import type { Admin, AdminRoleConfig, PrismaClient } from "@prisma/client";
import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLE_CATALOG_REVISION,
  DEFAULT_ADMIN_ROLE_TEMPLATES,
  FULL_ACCESS_ADMIN_ROLE_KEYS,
  type AdminPermission,
  type AdminRoleKey,
  type AdminRoleTemplate,
  type ResolvedAdminAccess,
} from "@cashsouk/types";

const validPermissions = new Set<string>(ADMIN_PERMISSIONS);
const roleTemplateByKey = new Map(
  DEFAULT_ADMIN_ROLE_TEMPLATES.map((template) => [template.key, template])
);

let syncedCatalogRevision: number | null = null;
let syncPromise: Promise<void> | null = null;

type AdminWithRoleConfig = Pick<Admin, "id" | "role_id" | "role_description"> & {
  role?: AdminRoleConfig | null;
};

function sanitizePermissions(permissions: string[]): AdminPermission[] {
  return permissions.filter((permission): permission is AdminPermission =>
    validPermissions.has(permission)
  );
}

function getDefaultTemplate(roleKey: string): AdminRoleTemplate | undefined {
  return roleTemplateByKey.get(roleKey as AdminRoleKey);
}

function toResolvedAccess(
  role: Pick<
    AdminRoleConfig,
    "key" | "name" | "description" | "permissions" | "is_system" | "is_editable" | "is_default"
  >
): ResolvedAdminAccess {
  const isSuperAdmin = FULL_ACCESS_ADMIN_ROLE_KEYS.includes(role.key as AdminRoleKey);
  const permissions = isSuperAdmin ? [...ADMIN_PERMISSIONS] : sanitizePermissions(role.permissions);

  return {
    roleKey: role.key as AdminRoleKey,
    roleName: role.name,
    description: role.description ?? null,
    permissions,
    isSuperAdmin,
    isSystemRole: role.is_system,
    isEditable: role.is_editable,
    isDefaultRole: role.is_default,
  };
}

async function syncTemplate(
  prisma: PrismaClient,
  template: AdminRoleTemplate
): Promise<void> {
  await prisma.adminRoleConfig.upsert({
    where: { key: template.key },
    create: {
      key: template.key,
      name: template.name,
      description: template.description,
      permissions: template.permissions,
      is_system: template.isSystem,
      is_editable: template.isEditable,
      is_default: template.isDefault,
    },
    update: template.isEditable
      ? {
          name: template.name,
          description: template.description,
          is_system: template.isSystem,
          is_editable: template.isEditable,
          is_default: template.isDefault,
        }
      : {
          name: template.name,
          description: template.description,
          permissions: template.permissions,
          is_system: template.isSystem,
          is_editable: template.isEditable,
          is_default: template.isDefault,
        },
  });
}

export async function ensureAdminRoleCatalog(prisma: PrismaClient): Promise<void> {
  if (syncedCatalogRevision === ADMIN_ROLE_CATALOG_REVISION) {
    return;
  }

  if (!syncPromise) {
    syncPromise = (async () => {
      for (const template of DEFAULT_ADMIN_ROLE_TEMPLATES) {
        await syncTemplate(prisma, template);
      }

      syncedCatalogRevision = ADMIN_ROLE_CATALOG_REVISION;
    })().finally(() => {
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

  const fallbackTemplate = getDefaultTemplate(admin.role_description);
  if (!fallbackTemplate) {
    throw new Error(`Unable to resolve admin RBAC role for admin ${admin.id}`);
  }

  return {
    roleKey: fallbackTemplate.key,
    roleName: fallbackTemplate.name,
    description: fallbackTemplate.description,
    permissions: FULL_ACCESS_ADMIN_ROLE_KEYS.includes(fallbackTemplate.key)
      ? [...ADMIN_PERMISSIONS]
      : [...fallbackTemplate.permissions],
    isSuperAdmin: FULL_ACCESS_ADMIN_ROLE_KEYS.includes(fallbackTemplate.key),
    isSystemRole: fallbackTemplate.isSystem,
    isEditable: fallbackTemplate.isEditable,
    isDefaultRole: fallbackTemplate.isDefault,
  };
}
