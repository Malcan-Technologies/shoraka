import type { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { getClientIp } from "../http/request-utils";
import { detectRoleFromRequest } from "../role-detector";

export const AUDIT_SOURCE = {
  API: "API",
  WEBHOOK: "WEBHOOK",
  SYSTEM_JOB: "SYSTEM_JOB",
  INTERNAL: "INTERNAL",
} as const;

export type AuditSource = (typeof AUDIT_SOURCE)[keyof typeof AUDIT_SOURCE];

export const AUDIT_ACTOR_TYPE = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPE)[keyof typeof AUDIT_ACTOR_TYPE];

export const AUDIT_PORTAL = {
  INVESTOR: "INVESTOR",
  ISSUER: "ISSUER",
  ADMIN: "ADMIN",
} as const;

export type AuditPortal = (typeof AUDIT_PORTAL)[keyof typeof AUDIT_PORTAL];

export type AuditRequestContext = {
  actorType: AuditActorType;
  actorUserId: string | null;
  source: AuditSource;
  portal: AuditPortal | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
};

export function auditPortalFromRole(role: UserRole | string | null | undefined): AuditPortal | null {
  if (!role) return null;
  const upper = String(role).toUpperCase();
  if (upper === "INVESTOR") return AUDIT_PORTAL.INVESTOR;
  if (upper === "ISSUER") return AUDIT_PORTAL.ISSUER;
  if (upper === "ADMIN") return AUDIT_PORTAL.ADMIN;
  return null;
}

export function auditPortalFromLegacy(portal: string | null | undefined): AuditPortal | null {
  return auditPortalFromRole(portal);
}

export function organizationKindFromPortalType(
  portalType: "investor" | "issuer"
): "INVESTOR" | "ISSUER" {
  return portalType === "investor" ? "INVESTOR" : "ISSUER";
}

function correlationIdFrom(req: Request, res?: Response): string | null {
  if (typeof res?.locals?.correlationId === "string") {
    return res.locals.correlationId;
  }
  const fromReq = (req as Request & { res?: { locals?: { correlationId?: string } } }).res
    ?.locals?.correlationId;
  if (typeof fromReq === "string") return fromReq;
  return null;
}

export function auditPortalFromRequest(req: Request): AuditPortal | null {
  if (req.activeRole) {
    return auditPortalFromRole(req.activeRole);
  }
  const detected = detectRoleFromRequest(req);
  if (detected) return auditPortalFromRole(detected);
  if (req.user?.roles.includes(UserRole.ADMIN)) return AUDIT_PORTAL.ADMIN;
  return auditPortalFromRole(req.user?.roles[0]);
}

export function auditContextFromRequest(
  req: Request,
  options?: {
    actorType?: AuditActorType;
    actorUserId?: string | null;
    portal?: AuditPortal | null;
    source?: AuditSource;
    res?: Response;
  }
): AuditRequestContext {
  const inferredAdmin = Boolean(req.user?.roles.includes(UserRole.ADMIN) && options?.portal === AUDIT_PORTAL.ADMIN);
  const actorType =
    options?.actorType ??
    (inferredAdmin || options?.portal === AUDIT_PORTAL.ADMIN
      ? AUDIT_ACTOR_TYPE.ADMIN
      : AUDIT_ACTOR_TYPE.USER);

  return {
    actorType,
    actorUserId: options?.actorUserId !== undefined ? options.actorUserId : req.user?.user_id ?? null,
    source: options?.source ?? AUDIT_SOURCE.API,
    portal: options?.portal !== undefined ? options.portal : auditPortalFromRequest(req),
    ipAddress: getClientIp(req) ?? null,
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    correlationId: correlationIdFrom(req, options?.res),
  };
}

export function auditContextFromAdminRequest(req: Request, res?: Response): AuditRequestContext {
  return auditContextFromRequest(req, {
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    portal: AUDIT_PORTAL.ADMIN,
    source: AUDIT_SOURCE.API,
    res,
  });
}

export function jsonAuditValue(value: unknown): import("@prisma/client").Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as import("@prisma/client").Prisma.InputJsonValue;
}
