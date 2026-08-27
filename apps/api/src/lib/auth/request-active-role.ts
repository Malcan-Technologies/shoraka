import { Request } from "express";
import { UserRole } from "@prisma/client";
import { AuthPortal, detectInitiatingPortal, parseKnownPortal } from "../role-detector";

const PORTAL_TO_ROLE: Record<AuthPortal, UserRole> = {
  investor: UserRole.INVESTOR,
  issuer: UserRole.ISSUER,
  admin: UserRole.ADMIN,
};

function headerValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function detectPortalFromLocalDevOrigin(req: Request): AuthPortal | null {
  const origin = req.get("origin") || req.get("referer");
  if (!origin) return null;
  try {
    const port = new URL(origin).port;
    if (port === "3002") return "investor";
    if (port === "3001") return "issuer";
    if (port === "3003") return "admin";
  } catch {
    return null;
  }
  return null;
}

/**
 * Portal the current HTTP request is acting from. Never defaults to investor.
 * Header first, then OAuth-style portal/role/host detection, then local portal ports.
 */
export function detectRequestContextPortal(req: Request): AuthPortal | null {
  const fromHeader = parseKnownPortal(headerValue(req.headers["x-portal"]));
  if (fromHeader) return fromHeader;

  const initiating = detectInitiatingPortal(req);
  if (initiating) return initiating;

  return detectPortalFromLocalDevOrigin(req);
}

export function requestedRoleFromRequest(req: Request): UserRole | null {
  const portal = detectRequestContextPortal(req);
  return portal ? PORTAL_TO_ROLE[portal] : null;
}

/**
 * Request context is only applied when the user actually has that role.
 * A spoofed ISSUER header on an INVESTOR-only user does not grant ISSUER.
 */
export function resolveActiveRole(
  userRoles: UserRole[],
  requested: UserRole | null
): UserRole | undefined {
  if (!requested) return undefined;
  if (userRoles.includes(requested)) return requested;
  return undefined;
}

/** After requireRole proves a single role, that role is the context for this request. */
export function fillActiveRoleFromRequiredRoles(
  current: UserRole | undefined,
  requiredRoles: UserRole[]
): UserRole | undefined {
  if (requiredRoles.length === 1) return requiredRoles[0];
  return current;
}
