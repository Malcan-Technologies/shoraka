"use client";

import { FULL_ACCESS_ADMIN_ROLE_KEYS, type AdminPermission } from "@cashsouk/types";
import { isAdminPortalUser } from "../lib/admin-auth-gate";
import { useCurrentUser } from "./use-current-user";

export function usePermissions() {
  const { data, isPending } = useCurrentUser();
  const permissions = data?.permissions ?? [];
  const roleKey = data?.roleKey;
  const hasFullAccessRole = roleKey ? FULL_ACCESS_ADMIN_ROLE_KEYS.includes(roleKey) : false;
  const isAdminUser = isAdminPortalUser(data?.user);

  const can = (permission: AdminPermission): boolean => {
    if (hasFullAccessRole) {
      return true;
    }

    return permissions.includes(permission);
  };

  const canAny = (...requiredPermissions: AdminPermission[]): boolean => {
    if (hasFullAccessRole) {
      return true;
    }

    return requiredPermissions.some((permission) => permissions.includes(permission));
  };

  return {
    permissions,
    roleKey,
    roleName: data?.roleName ?? null,
    can,
    canAny,
    isLoading: isPending,
    isAdminPortalUser: isAdminUser,
  };
}
