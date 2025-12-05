import { Request, Response, NextFunction } from "express";
import { AppError } from "../http/error-handler";
import { User, UserRole } from "@prisma/client";
import { prisma } from "../prisma";
import { verifyToken } from "./jwt";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      cognitoSub?: string;
      activeRole?: UserRole;
    }
  }
}

/**
 * Middleware to require authentication via JWT token
 * Validates token from Authorization header (Bearer token)
 * Access tokens are stored in Next.js memory, not cookies
 * Fetches user from database and attaches to req.user
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    // Check Authorization header for Bearer token
    // Access tokens are stored in Next.js memory and sent via Authorization header
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

    let payload;
    try {
      payload = verifyToken(token);
    } catch (error) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid or expired token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "User not found in database");
    }

    req.user = user;
    req.cognitoSub = user.cognito_sub;
    req.activeRole = payload.activeRole;

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
      next(new AppError(403, "FORBIDDEN", `Access denied. Required all roles: ${roles.join(", ")}`));
      return;
    }

    next();
  };
}

