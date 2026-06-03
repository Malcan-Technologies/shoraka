"use client";

import type { AdminPermission } from "@cashsouk/types";
import { useCurrentUser } from "./use-current-user";

export function usePermissions() {
  const { data, isLoading } = useCurrentUser();
  const permissions = data?.permissions ?? [];
  const roleKey = data?.roleKey;

  const can = (permission: AdminPermission): boolean => {
    if (roleKey === "SUPER_ADMIN") {
      return true;
    }

    return permissions.includes(permission);
  };

  const canAny = (...requiredPermissions: AdminPermission[]): boolean => {
    if (roleKey === "SUPER_ADMIN") {
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
    isLoading,
  };
}
