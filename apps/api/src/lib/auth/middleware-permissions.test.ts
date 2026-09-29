import { UserRole } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { AdminRole, type AdminPermission } from "@cashsouk/types";
import { requireAnyPermission, requirePermission, userHasPermission } from "./middleware";

function reqWith(options: {
  roles?: UserRole[];
  admin?: boolean;
  roleKey?: string;
  permissions?: AdminPermission[];
}) {
  const { roles = [UserRole.ADMIN], admin = true, roleKey = "TEST_ROLE", permissions = [] } = options;
  return {
    user: { user_id: "user-1", roles },
    admin: admin ? { user_id: "user-1" } : null,
    adminRoleKey: roleKey,
    adminPermissions: permissions,
  } as unknown as Request;
}

function statusOf(guard: ReturnType<typeof requirePermission>, req: Request): number {
  const next = jest.fn() as NextFunction;
  guard(req, {} as Response, next);
  const err = (next as jest.Mock).mock.calls[0][0] as { statusCode: number } | undefined;
  return err ? err.statusCode : 200;
}

const GUARDS = [
  ["requirePermission", requirePermission("notifications.view")],
  ["requireAnyPermission", requireAnyPermission("notifications.view", "audit.notifications.view")],
] as const;

describe.each(GUARDS)("%s requires Admin context", (_name, guard) => {
  it("allows an admin with the permission", () => {
    expect(statusOf(guard, reqWith({ permissions: ["notifications.view"] }))).toBe(200);
  });

  it("allows Super Admin without listed permissions", () => {
    expect(statusOf(guard, reqWith({ roleKey: AdminRole.SUPER_ADMIN }))).toBe(200);
  });

  it("denies an admin without the permission", () => {
    expect(statusOf(guard, reqWith({ permissions: ["notes.view"] }))).toBe(403);
  });

  it("denies a user without the ADMIN role even with permissions or a full-access key", () => {
    const roles = [UserRole.INVESTOR];
    expect(statusOf(guard, reqWith({ roles, permissions: ["notifications.view"] }))).toBe(403);
    expect(statusOf(guard, reqWith({ roles, roleKey: AdminRole.SUPER_ADMIN }))).toBe(403);
  });

  it("denies an ADMIN-role user with no admin record", () => {
    expect(
      statusOf(guard, reqWith({ admin: false, permissions: ["notifications.view"] }))
    ).toBe(403);
    expect(statusOf(guard, reqWith({ admin: false, roleKey: AdminRole.SUPER_ADMIN }))).toBe(403);
  });

  it("returns 401 when unauthenticated", () => {
    expect(statusOf(guard, {} as Request)).toBe(401);
  });
});

describe("userHasPermission requires Admin context", () => {
  it("is true for an admin with the permission and for Super Admin", () => {
    expect(userHasPermission(reqWith({ permissions: ["roles.manage"] }), "roles.manage")).toBe(true);
    expect(userHasPermission(reqWith({ roleKey: AdminRole.SUPER_ADMIN }), "roles.manage")).toBe(true);
  });

  it("is false without the permission", () => {
    expect(userHasPermission(reqWith({ permissions: ["roles.view"] }), "roles.manage")).toBe(false);
  });

  it("is false without the ADMIN role or an admin record", () => {
    expect(
      userHasPermission(
        reqWith({ roles: [UserRole.INVESTOR], roleKey: AdminRole.SUPER_ADMIN }),
        "roles.manage"
      )
    ).toBe(false);
    expect(
      userHasPermission(reqWith({ admin: false, permissions: ["roles.manage"] }), "roles.manage")
    ).toBe(false);
    expect(userHasPermission({} as Request, "roles.manage")).toBe(false);
  });
});
