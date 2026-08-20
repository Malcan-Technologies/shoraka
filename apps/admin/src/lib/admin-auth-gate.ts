import type { UserRole } from "@cashsouk/types";

export type AdminAuthUser = {
  roles: UserRole[];
  admin: { status: string } | null;
};

export type AdminAuthRedirect = "none" | "login" | "logout";
export type AuthGuardView = "checking" | "allow";
export type PermissionGateView = "loading" | "access-denied" | "allow";

export function isAdminPortalUser(user: AdminAuthUser | null | undefined): boolean {
  return (user?.roles.includes("ADMIN") ?? false) && user?.admin?.status === "ACTIVE";
}

/**
 * Destination after an authenticated user is rejected from Admin.
 * This is authorization, not an authentication failure — never /auth-error.
 */
export function unauthorizedAdminExitUrl(landingUrl: string): string {
  const trimmed = landingUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/auth-error")) {
    return trimmed.slice(0, -"/auth-error".length) || trimmed;
  }
  return trimmed;
}

/**
 * Redirect decision for the admin portal. Does not delay; callers should fire
 * login/logout as soon as the auth query has settled.
 */
export function resolveAdminAuthRedirect(input: {
  isPending: boolean;
  isError: boolean;
  user: AdminAuthUser | null | undefined;
}): AdminAuthRedirect {
  if (input.isPending) {
    return "none";
  }

  if (input.isError || !input.user) {
    return "login";
  }

  if (!isAdminPortalUser(input.user)) {
    return "logout";
  }

  return "none";
}

/**
 * AuthGuard render decision. Authenticated non-admins stay on the checking-auth
 * view until logout redirect completes — never the admin shell.
 */
export function resolveAuthGuardView(input: {
  skipGuard: boolean;
  isPending: boolean;
  isError: boolean;
  user: AdminAuthUser | null | undefined;
}): AuthGuardView {
  if (input.skipGuard) {
    return "allow";
  }

  if (resolveAdminAuthRedirect(input) !== "none") {
    return "checking";
  }

  if (input.isPending || !isAdminPortalUser(input.user)) {
    return "checking";
  }

  return "allow";
}

/**
 * Page-level permission UI. Access Denied is only for an authenticated admin
 * who lacks a specific permission — not for Issuer/Investor/unauthenticated users.
 */
export function resolvePermissionGate(input: {
  isPending: boolean;
  isAdminPortalUser: boolean;
  hasPermission: boolean;
}): PermissionGateView {
  if (input.isPending || !input.isAdminPortalUser) {
    return "loading";
  }

  if (!input.hasPermission) {
    return "access-denied";
  }

  return "allow";
}
