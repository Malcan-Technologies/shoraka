import type { Request, Response } from "express";
import { getClientIp } from "../../../lib/http/request-utils";
import {
  LEGAL_ADMIN_AUDIT_ACTOR_TYPE,
  LEGAL_ADMIN_AUDIT_PORTAL,
  LEGAL_ADMIN_AUDIT_SOURCE,
  type LegalAdminAuditActorType,
  type LegalAdminAuditPortal,
  type LegalAdminAuditSource,
} from "./events";

export type LegalAdminAuditContext = {
  actorType: LegalAdminAuditActorType;
  actorUserId: string;
  organizationId: null;
  organizationKind: null;
  source: LegalAdminAuditSource;
  portal: LegalAdminAuditPortal;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
};

function correlationIdFrom(req: Request, res?: Response): string | null {
  if (typeof res?.locals?.correlationId === "string") {
    return res.locals.correlationId;
  }
  const fromReq = (req as Request & { res?: { locals?: { correlationId?: string } } }).res
    ?.locals?.correlationId;
  return typeof fromReq === "string" ? fromReq : null;
}

function buildContext(req: Request, actorUserId: string, res?: Response): LegalAdminAuditContext {
  return {
    actorType: LEGAL_ADMIN_AUDIT_ACTOR_TYPE.ADMIN,
    actorUserId,
    organizationId: null,
    organizationKind: null,
    source: LEGAL_ADMIN_AUDIT_SOURCE.API,
    portal: LEGAL_ADMIN_AUDIT_PORTAL.ADMIN,
    ipAddress: getClientIp(req) ?? null,
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    correlationId: correlationIdFrom(req, res),
    idempotencyKey: null,
  };
}

export function auditContextFromAdminRequest(req: Request, res: Response): LegalAdminAuditContext {
  const actorUserId = req.user?.user_id;
  if (!actorUserId) {
    throw new Error("Authenticated admin user is required to write legal admin audit events.");
  }
  return buildContext(req, actorUserId, res);
}

export function auditContextForActor(req: Request, actorUserId: string): LegalAdminAuditContext {
  return buildContext(req, actorUserId);
}
