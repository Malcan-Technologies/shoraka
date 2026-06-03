import { Request, Response, NextFunction } from "express";
import { AppError } from "../http/error-handler";
import { Admin, AdminRoleConfig, User, UserRole } from "@prisma/client";
import type { AdminPermission, AdminRoleKey } from "@cashsouk/types";
import { prisma } from "../prisma";
import { verifyCognitoAccessToken } from "./cognito-jwt-verifier";
import { resolveAdminAccess } from "./rbac";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      admin?: (Admin & { role?: AdminRoleConfig | null }) | null;
      adminPermissions?: AdminPermission[];
      adminRoleKey?: AdminRoleKey;
      adminRoleName?: string;
      cognitoSub?: string;
      activeRole?: UserRole;
    }
  }
}

/**
 * Middleware to require authentication via Cognito JWT token
 * Validates Cognito access token from Authorization header (Bearer token)
 * Tokens are managed by AWS Amplify on the frontend
 * Fetches user from database by cognito_sub and attaches to req.user
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    // Check Authorization header for Bearer token
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }

    if (!token) {
      throw new AppError(
        401,
        "UNAUTHORIZED",
        "No authentication token provided. Please include a Bearer token in the Authorization header."
      );
    }

    // Verify Cognito access token
    let cognitoPayload;
    try {
      cognitoPayload = await verifyCognitoAccessToken(token);
    } catch (error) {
      throw new AppError(
        401,
        "UNAUTHORIZED",
        `Invalid or expired Cognito token: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Find user by Cognito sub (user ID from Cognito)
    const user = await prisma.user.findUnique({
      where: { cognito_sub: cognitoPayload.sub },
    });

    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "User not found in database");
    }

    // Set user and cognito sub on request
    req.user = user;
    req.cognitoSub = cognitoPayload.sub;
    // Default activeRole to first role (can be changed via role switching endpoint)
    req.activeRole = user.roles[0] || UserRole.INVESTOR;

    if (user.roles.includes(UserRole.ADMIN)) {
      const admin = await prisma.admin.findUnique({
        where: { user_id: user.user_id },
        include: {
          role: true,
        },
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
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(401, "UNAUTHORIZED", "Invalid or expired token"));
    }
  }
}

/**
 * Middleware to require one or more specific roles
 * User must have at least one of the specified roles
 *
 * @example
 * router.get('/admin', requireAuth, requireRole(UserRole.ADMIN), handler);
 * router.get('/investor-or-admin', requireAuth, requireRole(UserRole.INVESTOR, UserRole.ADMIN), handler);
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
      return;
    }

    // Check if user has any of the required roles
    const hasRole = req.user.roles.some((userRole) => roles.includes(userRole));

    if (!hasRole) {
      next(new AppError(403, "FORBIDDEN", `Access denied. Required role(s): ${roles.join(", ")}`));
      return;
    }

    // For INVESTOR/ISSUER roles, also check onboarding completion (array length > 0)
    if (roles.includes(UserRole.INVESTOR) && req.user.investor_account.length === 0) {
      next(new AppError(403, "FORBIDDEN", "Investor onboarding must be completed to access this resource"));
      return;
    }

    if (roles.includes(UserRole.ISSUER) && req.user.issuer_account.length === 0) {
      next(new AppError(403, "FORBIDDEN", "Issuer onboarding must be completed to access this resource"));
      return;
    }

    next();
  };
}

/**
 * Middleware to require ALL specified roles (user must have every role)
 *
 * @example
 * router.get('/investor-and-issuer', requireAuth, requireAllRoles(UserRole.INVESTOR, UserRole.ISSUER), handler);
 */
export function requireAllRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
      return;
    }

    // Check if user has all required roles
    const hasAllRoles = roles.every((role) => req.user!.roles.includes(role));

    if (!hasAllRoles) {
      next(
        new AppError(403, "FORBIDDEN", `Access denied. Required all roles: ${roles.join(", ")}`)
      );
      return;
    }

    next();
  };
}

function hasRequiredPermissions(req: Request, permissions: AdminPermission[]): boolean {
  if (!req.user || !req.user.roles.includes(UserRole.ADMIN) || !req.admin) {
    return false;
  }

  if (req.adminRoleKey === "SUPER_ADMIN") {
    return true;
  }

  const assignedPermissions = new Set(req.adminPermissions ?? []);
  return permissions.every((permission) => assignedPermissions.has(permission));
}

export function requirePermission(...permissions: AdminPermission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
      return;
    }

    if (!hasRequiredPermissions(req, permissions)) {
      next(new AppError(403, "FORBIDDEN", "Insufficient permissions"));
      return;
    }

    next();
  };
}

export function requireAnyPermission(...permissions: AdminPermission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
      return;
    }

    if (req.adminRoleKey === "SUPER_ADMIN") {
      next();
      return;
    }

    const assignedPermissions = new Set(req.adminPermissions ?? []);
    const hasAnyPermission = permissions.some((permission) => assignedPermissions.has(permission));

    if (!hasAnyPermission) {
      next(new AppError(403, "FORBIDDEN", "Insufficient permissions"));
      return;
    }

    next();
  };
}

export function userHasPermission(req: Request, permission: AdminPermission): boolean {
  if (req.adminRoleKey === "SUPER_ADMIN") {
    return true;
  }

  return (req.adminPermissions ?? []).includes(permission);
}
