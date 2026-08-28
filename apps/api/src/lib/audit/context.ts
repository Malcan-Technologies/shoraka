/**
 * Shared audit field conventions for the existing origin/main log tables.
 *
 * These vocabularies are applied additively: every log table keeps its own shape and its own
 * anchor/legacy columns, and only the fields that are meaningful for that table are populated.
 * `created_at` is the occurred-at field on every table — there is deliberately no second timestamp.
 */

import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { getClientIp } from "../http/request-utils";

export const AUDIT_ACTOR_TYPE = {
  /** Authenticated end user acting on their own resources. */
  USER: "USER",
  /** Platform administrator, including admin acting on behalf of another party. */
  ADMIN: "ADMIN",
  /** Scheduled job, expiry sweep or internal recomputation with no human actor. */
  SYSTEM: "SYSTEM",
  /** Third-party provider callback (RegTank, Curlec, SigningCloud, Shoraka). */
  INTEGRATION: "INTEGRATION",
} as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPE)[keyof typeof AUDIT_ACTOR_TYPE];

export const AUDIT_SOURCE = {
  /** Inbound authenticated HTTP request. */
  API: "API",
  /** Provider webhook. */
  WEBHOOK: "WEBHOOK",
  /** Cron / scheduled job. */
  SYSTEM_JOB: "SYSTEM_JOB",
  /** Internal service-to-service or derived recomputation. */
  INTERNAL: "INTERNAL",
} as const;

export type AuditSource = (typeof AUDIT_SOURCE)[keyof typeof AUDIT_SOURCE];

export const AUDIT_PORTAL = {
  INVESTOR: "INVESTOR",
  ISSUER: "ISSUER",
  ADMIN: "ADMIN",
  PUBLIC: "PUBLIC",
} as const;

export type AuditPortal = (typeof AUDIT_PORTAL)[keyof typeof AUDIT_PORTAL];

export const AUDIT_ORGANIZATION_KIND = {
  INVESTOR: "INVESTOR",
  ISSUER: "ISSUER",
} as const;

export type AuditOrganizationKind =
  (typeof AUDIT_ORGANIZATION_KIND)[keyof typeof AUDIT_ORGANIZATION_KIND];

/**
 * Target vocabulary shared across domains. Each table only uses the members that apply to it.
 * `notification_logs.target_type` is NOT part of this vocabulary — that column already means
 * "audience type" on origin/main and is left alone.
 */
export const AUDIT_TARGET_TYPE = {
  USER: "USER",
  ADMIN_ROLE: "ADMIN_ROLE",
  ADMIN_INVITATION: "ADMIN_INVITATION",
  ORGANIZATION: "ORGANIZATION",
  ONBOARDING: "ONBOARDING",
  APPLICATION: "APPLICATION",
  APPLICATION_SECTION: "APPLICATION_SECTION",
  APPLICATION_ITEM: "APPLICATION_ITEM",
  CONTRACT: "CONTRACT",
  INVOICE: "INVOICE",
  SIGNING_ENVELOPE: "SIGNING_ENVELOPE",
  LEGAL_DOCUMENT: "LEGAL_DOCUMENT",
  LEGAL_DOCUMENT_VERSION: "LEGAL_DOCUMENT_VERSION",
  PRODUCT: "PRODUCT",
  NOTE: "NOTE",
  NOTE_INVESTMENT: "NOTE_INVESTMENT",
  NOTE_PAYMENT: "NOTE_PAYMENT",
  NOTE_SETTLEMENT: "NOTE_SETTLEMENT",
  NOTE_PROSPECTUS: "NOTE_PROSPECTUS",
  WITHDRAWAL: "WITHDRAWAL",
  SHORAKA_ORDER: "SHORAKA_ORDER",
  GATEWAY_PAYMENT: "GATEWAY_PAYMENT",
  PLATFORM_FINANCE_SETTINGS: "PLATFORM_FINANCE_SETTINGS",
} as const;

export type AuditTargetType = (typeof AUDIT_TARGET_TYPE)[keyof typeof AUDIT_TARGET_TYPE];

/**
 * Request-independent forensic context. Every standardized writer accepts one of these; when a
 * call site does not supply it the writer falls back to the legacy per-field parameters so no
 * existing behaviour changes.
 */
export type AuditRequestContext = {
  actorType: AuditActorType;
  actorUserId: string | null;
  source: AuditSource;
  portal: AuditPortal | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
};

type RequestWithLocals = Request & { res?: { locals?: { correlationId?: unknown } } };

/** `correlationIdMiddleware` stamps `res.locals.correlationId` for every request. */
export function correlationIdFromRequest(req: Request, res?: Response): string | null {
  if (typeof res?.locals?.correlationId === "string") {
    return res.locals.correlationId;
  }
  const fromReq = (req as RequestWithLocals).res?.locals?.correlationId;
  return typeof fromReq === "string" ? fromReq : null;
}

/**
 * Best-effort portal inference. The `x-portal` header is set by the portal API clients; the
 * referer host is the fallback. Returns null rather than guessing when neither is usable.
 */
export function auditPortalFromRequest(req: Request): AuditPortal | null {
  const header = req.headers["x-portal"];
  const raw = (typeof header === "string" ? header : "").trim().toUpperCase();
  if (raw === "INVESTOR" || raw === "ISSUER" || raw === "ADMIN") {
    return raw as AuditPortal;
  }

  const referer = typeof req.headers.referer === "string" ? req.headers.referer.toLowerCase() : "";
  if (referer.includes("admin")) return AUDIT_PORTAL.ADMIN;
  if (referer.includes("issuer")) return AUDIT_PORTAL.ISSUER;
  if (referer.includes("investor")) return AUDIT_PORTAL.INVESTOR;
  return null;
}

export function auditPortalFromString(value: string | null | undefined): AuditPortal | null {
  const raw = (value ?? "").trim().toUpperCase();
  if (raw === "INVESTOR" || raw === "ISSUER" || raw === "ADMIN" || raw === "PUBLIC") {
    return raw as AuditPortal;
  }
  return null;
}

export function auditOrganizationKindFromPortal(
  portal: AuditPortal | string | null | undefined
): AuditOrganizationKind | null {
  const raw = (typeof portal === "string" ? portal : "").trim().toUpperCase();
  if (raw === "INVESTOR") return AUDIT_ORGANIZATION_KIND.INVESTOR;
  if (raw === "ISSUER") return AUDIT_ORGANIZATION_KIND.ISSUER;
  return null;
}

/** Derive the actor type from an explicit portal, falling back to the requester's roles. */
export function auditActorTypeFor(options: {
  portal?: AuditPortal | string | null;
  roles?: UserRole[] | null;
  hasActor?: boolean;
}): AuditActorType {
  if (options.hasActor === false) return AUDIT_ACTOR_TYPE.SYSTEM;
  const portal = auditPortalFromString(
    typeof options.portal === "string" ? options.portal : (options.portal ?? null)
  );
  if (portal === AUDIT_PORTAL.ADMIN) return AUDIT_ACTOR_TYPE.ADMIN;
  if (portal === AUDIT_PORTAL.ISSUER || portal === AUDIT_PORTAL.INVESTOR) {
    return AUDIT_ACTOR_TYPE.USER;
  }
  if (options.roles?.includes(UserRole.ADMIN)) return AUDIT_ACTOR_TYPE.ADMIN;
  return AUDIT_ACTOR_TYPE.USER;
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
  const portal = options?.portal !== undefined ? options.portal : auditPortalFromRequest(req);
  const actorUserId =
    options?.actorUserId !== undefined ? options.actorUserId : (req.user?.user_id ?? null);
  const userAgent = req.headers["user-agent"];

  return {
    actorType:
      options?.actorType ??
      auditActorTypeFor({ portal, roles: req.user?.roles ?? null, hasActor: Boolean(actorUserId) }),
    actorUserId,
    source: options?.source ?? AUDIT_SOURCE.API,
    portal,
    ipAddress: getClientIp(req) ?? null,
    userAgent: typeof userAgent === "string" ? userAgent : null,
    correlationId: correlationIdFromRequest(req, options?.res),
  };
}

export function issuerActivityFromRequest(req: Request, res?: Response) {
  const context = auditContextFromRequest(req, { res });
  return {
    context,
    ipAddress: context.ipAddress ?? undefined,
    userAgent: context.userAgent ?? undefined,
  };
}

/** Authenticated portal/API request constructed outside Express (e.g. checkout status sync). */
export function apiAuditContext(options?: {
  actorUserId?: string | null;
  actorType?: AuditActorType;
  portal?: AuditPortal | null;
  correlationId?: string | null;
}): AuditRequestContext {
  const actorUserId = options?.actorUserId ?? null;
  return {
    actorType:
      options?.actorType ??
      (actorUserId ? AUDIT_ACTOR_TYPE.USER : AUDIT_ACTOR_TYPE.SYSTEM),
    actorUserId,
    source: AUDIT_SOURCE.API,
    portal: options?.portal ?? null,
    ipAddress: null,
    userAgent: null,
    correlationId: options?.correlationId ?? null,
  };
}

/** Provider callback context: no request-bound actor, no IP worth trusting. */
export function webhookAuditContext(options?: {
  actorUserId?: string | null;
  portal?: AuditPortal | null;
  correlationId?: string | null;
}): AuditRequestContext {
  return {
    actorType: AUDIT_ACTOR_TYPE.INTEGRATION,
    actorUserId: options?.actorUserId ?? null,
    source: AUDIT_SOURCE.WEBHOOK,
    portal: options?.portal ?? null,
    ipAddress: null,
    userAgent: null,
    correlationId: options?.correlationId ?? null,
  };
}

/** Cron / sweep context. `actorUserId` (e.g. `SYS`) is identity only — never an Admin actor_type. */
export function systemAuditContext(options?: {
  portal?: AuditPortal | null;
  actorUserId?: string | null;
  correlationId?: string | null;
  source?: Extract<AuditSource, "SYSTEM_JOB" | "INTERNAL">;
}): AuditRequestContext {
  return {
    actorType: AUDIT_ACTOR_TYPE.SYSTEM,
    actorUserId: options?.actorUserId ?? null,
    source: options?.source ?? AUDIT_SOURCE.SYSTEM_JOB,
    portal: options?.portal ?? null,
    ipAddress: null,
    userAgent: null,
    correlationId: options?.correlationId ?? null,
  };
}

/** Derived/internal recomputation triggered by another business write. */
export function internalAuditContext(options?: {
  actorUserId?: string | null;
  portal?: AuditPortal | null;
  correlationId?: string | null;
}): AuditRequestContext {
  return systemAuditContext({ ...options, source: AUDIT_SOURCE.INTERNAL });
}

export function jsonAuditValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
