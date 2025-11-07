import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "./jwt";
import { AppError } from "../http/error-handler";
import { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError(401, "UNAUTHORIZED", "Missing or invalid authorization header");
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(401, "UNAUTHORIZED", "Invalid or expired token"));
    }
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError(403, "FORBIDDEN", "Insufficient permissions"));
      return;
    }

    next();
  };
}

