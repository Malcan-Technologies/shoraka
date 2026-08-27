import { Request } from "express";
import { UserRole } from "@prisma/client";
import { logger } from "./logger";

export type AuthPortal = "investor" | "issuer" | "admin";

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

function firstQueryString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

/** Maps INVESTOR/investor (and issuer/admin) to a portal id. Unknown values stay null. */
export function parseKnownPortal(value: unknown): AuthPortal | null {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "investor" || raw === "issuer" || raw === "admin") return raw;
  return null;
}

export function detectPortalFromHostname(originOrReferer: string | undefined): AuthPortal | null {
  if (!originOrReferer) return null;
  try {
    const hostname = new URL(originOrReferer).hostname.toLowerCase();
    if (hostname.includes("admin")) return "admin";
    if (hostname.includes("issuer")) return "issuer";
    if (hostname.includes("investor")) return "investor";
  } catch (error) {
    logger.warn({ origin: originOrReferer, error }, "Failed to parse origin URL");
  }
  return null;
}

/**
 * Portal that initiated this request. Never defaults to investor.
 * Order: explicit ?portal=, then ?role= when it names a portal, then Origin/Referer host.
 */
export function detectInitiatingPortal(req: Request): AuthPortal | null {
  const fromPortal = parseKnownPortal(firstQueryString(req.query.portal));
  if (fromPortal) return fromPortal;

  const fromRole = parseKnownPortal(firstQueryString(req.query.role));
  if (fromRole) return fromRole;

  return detectPortalFromHostname(req.get("origin") || req.get("referer"));
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

