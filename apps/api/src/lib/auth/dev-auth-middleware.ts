import { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { UserRole, User } from "@prisma/client";
import { resolveAdminAccess } from "./rbac";

/**
 * Development-only middleware that bypasses authentication
 * Sets a mock admin user from the database for testing
 * Only works when DISABLE_AUTH=true is set in environment
 */
export async function devAuthBypass(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // Only work in non-production environments
  if (process.env.NODE_ENV === "production") {
    return next();
  }

  // Only work if DISABLE_AUTH is explicitly set to "true"
  if (process.env.DISABLE_AUTH !== "true") {
    return next();
  }

  try {
    // Prefer a SUPER_ADMIN with role config so requirePermission works under bypass.
    let adminUser = await prisma.user.findFirst({
      where: {
        roles: { has: UserRole.ADMIN },
        admin: { isNot: null },
      },
      orderBy: { created_at: "asc" },
    });

    if (!adminUser) {
      adminUser = await prisma.user.findFirst({
        where: { roles: { has: UserRole.ADMIN } },
      });
    }

    if (!adminUser) {
      adminUser = {
        user_id: "DEVAD",
        email: "admin@cashsouk.com",
        cognito_sub: "dev-admin-sub",
        cognito_username: "dev-admin",
        roles: [UserRole.ADMIN],
        first_name: "Dev",
        last_name: "Admin",
        phone: null,
        investor_account: [],
        issuer_account: [],
        password_changed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as User;
    }

    req.user = adminUser;
    req.cognitoSub = adminUser.cognito_sub ?? undefined;
    req.activeRole = UserRole.ADMIN;

    if (adminUser.user_id !== "DEVAD") {
      const admin = await prisma.admin.findUnique({
        where: { user_id: adminUser.user_id },
        include: { role: true },
      });
      req.admin = admin;
      if (admin) {
        const access = await resolveAdminAccess(prisma, admin);
        req.adminPermissions = access.permissions;
        req.adminRoleKey = access.roleKey;
        req.adminRoleName = access.roleName;
      } else {
        req.adminPermissions = [];
      }
    } else {
      req.admin = null;
      req.adminPermissions = [];
    }

    next();
  } catch {
    req.user = {
      user_id: "DEVAD",
      email: "admin@cashsouk.com",
      cognito_sub: "dev-admin-sub",
      cognito_username: "dev-admin",
      roles: [UserRole.ADMIN],
      first_name: "Dev",
      last_name: "Admin",
      phone: null,
      investor_account: [],
      issuer_account: [],
      password_changed_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as unknown as User;
    req.cognitoSub = "dev-admin-sub";
    req.activeRole = UserRole.ADMIN;
    req.admin = null;
    req.adminPermissions = [];
    next();
  }
}
