import { Request } from "express";
import { UserRole } from "@prisma/client";
import { logger } from "./logger";

/**
 * Get portal name from UserRole
 * Maps role enum to portal string identifier
 */
export function getPortalFromRole(role: UserRole): string {
  switch (role) {
    case UserRole.INVESTOR:
      return "investor";
    case UserRole.ISSUER:
      return "issuer";
    case UserRole.ADMIN:
      return "admin";
    default:
      return "unknown";
  }
}

export function detectRoleFromRequest(req: Request): UserRole | null {
  // Check query parameter first (explicit role selection) - this takes absolute priority
  const roleParam = req.query.role as string;
  if (roleParam) {
    const upperRole = roleParam.toUpperCase().trim();
    logger.info({ roleParam, upperRole, query: req.query }, "Detecting role from query parameter");
    if (upperRole === "INVESTOR") {
      return UserRole.INVESTOR;
    }
    if (upperRole === "ISSUER") {
      return UserRole.ISSUER;
    }
    if (upperRole === "ADMIN") {
      return UserRole.ADMIN;
    }
    logger.warn({ roleParam, upperRole }, "Invalid role parameter, ignoring");
  }

  // Check origin/referer header for domain-based detection
  const origin = req.get("origin") || req.get("referer");

  if (origin) {
    try {
      const url = new URL(origin);
      const hostname = url.hostname.toLowerCase();

      if (hostname.includes("investor")) {
        return UserRole.INVESTOR;
      }
      if (hostname.includes("issuer")) {
        return UserRole.ISSUER;
      }
      if (hostname.includes("admin")) {
        return UserRole.ADMIN;
      }
    } catch (error) {
      logger.warn({ origin, error }, "Failed to parse origin URL");
    }
  }

  return null;
}

