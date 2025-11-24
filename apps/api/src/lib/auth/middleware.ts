import { Request, Response, NextFunction } from "express";
import { verifyCognitoAndExtract } from "./cognito";
import { AppError } from "../http/error-handler";
import { User, UserRole } from "@prisma/client";
import { prisma } from "../prisma";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      cognitoSub?: string;
    }
  }
}

/**
 * Middleware to require authentication via Cognito token
 * Validates token, fetches user from database, and attaches to req.user
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError(401, "UNAUTHORIZED", "Missing or invalid authorization header");
    }

    const token = authHeader.substring(7);
    
    // Verify Cognito token
    const cognitoPayload = await verifyCognitoAndExtract(token);
    req.cognitoSub = cognitoPayload.sub;
    
    // Fetch user from database using Cognito sub
    const user = await prisma.user.findUnique({
      where: { cognito_sub: cognitoPayload.sub },
    });
    
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "User not found in database. Please complete signup.");
    }
    
    // Attach user to request
    req.user = user;
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

