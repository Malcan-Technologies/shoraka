import { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { UserRole, User } from "@prisma/client";

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
    // Try to find an admin user in the database
    // If none exists, create a mock user object
    let adminUser = await prisma.user.findFirst({
      where: {
        roles: {
          has: UserRole.ADMIN,
        },
      },
    });

    // If no admin user exists, create a mock one (won't persist, just for req.user)
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

    // Ensure adminUser is not null (convert null to undefined for req.user type)
    // After the if check above, adminUser is guaranteed to be non-null
    req.user = adminUser ?? undefined;
    req.cognitoSub = adminUser!.cognito_sub ?? undefined;
    req.activeRole = UserRole.ADMIN;

    next();
  } catch (error) {
    // If database query fails, still allow through with mock user
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
    next();
  }
}

