import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isAdminPortalUser,
  resolveAdminAuthRedirect,
  resolveAuthGuardView,
  resolvePermissionGate,
  unauthorizedAdminExitUrl,
} from "./admin-auth-gate";
import type { AdminAuthUser } from "./admin-auth-gate";

const issuer: AdminAuthUser = { roles: ["ISSUER"], admin: null };
const investor: AdminAuthUser = { roles: ["INVESTOR"], admin: null };
const noRoles: AdminAuthUser = { roles: [], admin: null };
const activeAdmin: AdminAuthUser = { roles: ["ADMIN"], admin: { status: "ACTIVE" } };
const inactiveAdmin: AdminAuthUser = { roles: ["ADMIN"], admin: { status: "DISABLED" } };

describe("isAdminPortalUser", () => {
  it("is true only for an ACTIVE ADMIN", () => {
    expect(isAdminPortalUser(activeAdmin)).toBe(true);
    expect(isAdminPortalUser(inactiveAdmin)).toBe(false);
    expect(isAdminPortalUser(issuer)).toBe(false);
    expect(isAdminPortalUser(investor)).toBe(false);
    expect(isAdminPortalUser(noRoles)).toBe(false);
    expect(isAdminPortalUser(undefined)).toBe(false);
  });
});

describe("resolveAdminAuthRedirect", () => {
  it("A. unauthenticated: redirects to login after auth has settled", () => {
    expect(
      resolveAdminAuthRedirect({ isPending: true, isError: false, user: undefined })
    ).toBe("none");
    expect(
      resolveAdminAuthRedirect({ isPending: false, isError: true, user: undefined })
    ).toBe("login");
    expect(
      resolveAdminAuthRedirect({ isPending: false, isError: false, user: undefined })
    ).toBe("login");
  });

  it("B. authenticated ISSUER: logs out toward landing, does not stay in admin", () => {
    expect(
      resolveAdminAuthRedirect({ isPending: false, isError: false, user: issuer })
    ).toBe("logout");
  });

  it("C. authenticated INVESTOR: logs out toward landing", () => {
    expect(
      resolveAdminAuthRedirect({ isPending: false, isError: false, user: investor })
    ).toBe("logout");
  });

  it("D. authenticated with roles = []: logs out toward landing", () => {
    expect(
      resolveAdminAuthRedirect({ isPending: false, isError: false, user: noRoles })
    ).toBe("logout");
  });

  it("E/F. authenticated ACTIVE ADMIN: no redirect (permission UI handles 403)", () => {
    expect(
      resolveAdminAuthRedirect({ isPending: false, isError: false, user: activeAdmin })
    ).toBe("none");
  });

  it("does not redirect on every render of an already-decided admin (no loop)", () => {
    const settledAdmin = resolveAdminAuthRedirect({
      isPending: false,
      isError: false,
      user: activeAdmin,
    });
    expect(settledAdmin).toBe("none");
    expect(
      resolveAdminAuthRedirect({ isPending: false, isError: false, user: activeAdmin })
    ).toBe(settledAdmin);
  });
});

describe("resolveAuthGuardView", () => {
  const settled = { skipGuard: false, isPending: false, isError: false };

  it("A. unauthenticated: checking-auth view, not the admin shell", () => {
    expect(
      resolveAuthGuardView({ skipGuard: false, isPending: true, isError: false, user: undefined })
    ).toBe("checking");
    expect(
      resolveAuthGuardView({ skipGuard: false, isPending: false, isError: true, user: undefined })
    ).toBe("checking");
    expect(
      resolveAuthGuardView({ skipGuard: false, isPending: false, isError: false, user: undefined })
    ).toBe("checking");
  });

  it("B/C/D. authenticated non-admins: checking-auth view while redirect runs", () => {
    expect(resolveAuthGuardView({ ...settled, user: issuer })).toBe("checking");
    expect(resolveAuthGuardView({ ...settled, user: investor })).toBe("checking");
    expect(resolveAuthGuardView({ ...settled, user: noRoles })).toBe("checking");
  });

  it("E/F. authenticated ACTIVE ADMIN: render the admin shell", () => {
    expect(resolveAuthGuardView({ ...settled, user: activeAdmin })).toBe("allow");
  });

  it("callback skipGuard still renders children without looping", () => {
    expect(
      resolveAuthGuardView({
        skipGuard: true,
        isPending: false,
        isError: false,
        user: issuer,
      })
    ).toBe("allow");
  });
});

describe("resolvePermissionGate", () => {
  it("A. unauthenticated / still pending: loading, not Access Denied", () => {
    expect(
      resolvePermissionGate({
        isPending: true,
        isAdminPortalUser: false,
        hasPermission: false,
      })
    ).toBe("loading");
    expect(
      resolvePermissionGate({
        isPending: false,
        isAdminPortalUser: false,
        hasPermission: false,
      })
    ).toBe("loading");
  });

  it("B. ISSUER: loading, Access Denied is not shown", () => {
    expect(
      resolvePermissionGate({
        isPending: false,
        isAdminPortalUser: isAdminPortalUser(issuer),
        hasPermission: false,
      })
    ).toBe("loading");
  });

  it("C. INVESTOR: loading, Access Denied is not shown", () => {
    expect(
      resolvePermissionGate({
        isPending: false,
        isAdminPortalUser: isAdminPortalUser(investor),
        hasPermission: false,
      })
    ).toBe("loading");
  });

  it("D. roles = []: loading, Access Denied is not shown", () => {
    expect(
      resolvePermissionGate({
        isPending: false,
        isAdminPortalUser: isAdminPortalUser(noRoles),
        hasPermission: false,
      })
    ).toBe("loading");
  });

  it("E. ADMIN with required permission: allow content", () => {
    expect(
      resolvePermissionGate({
        isPending: false,
        isAdminPortalUser: true,
        hasPermission: true,
      })
    ).toBe("allow");
  });

  it("F. ADMIN without required permission: Access Denied, no redirect", () => {
    expect(
      resolvePermissionGate({
        isPending: false,
        isAdminPortalUser: true,
        hasPermission: false,
      })
    ).toBe("access-denied");
    expect(
      resolveAdminAuthRedirect({ isPending: false, isError: false, user: activeAdmin })
    ).toBe("none");
  });
});

describe("unauthorizedAdminExitUrl", () => {
  const landing = "http://localhost:3000";

  it("ISSUER / INVESTOR / empty roles / inactive ADMIN go to landing, not /auth-error", () => {
    expect(unauthorizedAdminExitUrl(landing)).toBe(landing);
    expect(unauthorizedAdminExitUrl(`${landing}/`)).toBe(landing);
    expect(unauthorizedAdminExitUrl(`${landing}/auth-error`)).toBe(landing);
    expect(unauthorizedAdminExitUrl(landing)).not.toContain("/auth-error");
  });

  it("does not loop through callback or admin", () => {
    const dest = unauthorizedAdminExitUrl(landing);
    expect(dest).not.toMatch(/auth-error/);
    expect(dest).not.toMatch(/callback/);
    expect(dest).not.toMatch(/:3003/);
  });
});

describe("admin auth UX wiring", () => {
  const root = join(__dirname, "..");
  const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

  it("AuthGuard never renders AccessDeniedCard", () => {
    const authGuard = read("components/auth-guard.tsx");
    expect(authGuard).not.toContain("AccessDeniedCard");
    expect(authGuard).toContain("Verifying authentication...");
    expect(authGuard).toContain('gate !== "allow"');
  });

  it("RequirePermission only shows Access Denied for admin permission misses", () => {
    const requirePermission = read("components/require-permission.tsx");
    expect(requirePermission).toContain("resolvePermissionGate");
    expect(requirePermission).toContain("isAdminPortalUser");
    expect(requirePermission).toContain('view === "access-denied"');
    expect(requirePermission).toContain('view === "loading"');
  });

  it("useAuth sends unauthorized users to landing home, not /auth-error", () => {
    const auth = read("lib/auth.ts");
    expect(auth).toContain("resolveAdminAuthRedirect");
    expect(auth).toContain('redirect === "login"');
    expect(auth).toContain("redirectToLogin()");
    expect(auth).toContain('redirect === "logout"');
    expect(auth).toContain("exitUnauthorizedAdmin(getAccessToken)");
    expect(auth).toContain("unauthorizedAdminExitUrl");
    expect(auth).toContain("window.location.replace(landingHomeUrl())");
    expect(auth).not.toMatch(/exitUnauthorizedAdmin[\s\S]*cognitoLogoutUrl/);
  });

  it("audit page keeps Access Denied for admins missing audit permission", () => {
    const auditPage = read("app/audit/page.tsx");
    expect(auditPage).toContain("resolvePermissionGate");
    expect(auditPage).toContain("isAdminPortalUser");
    expect(auditPage).toContain("<AccessDeniedCard />");
  });
});
