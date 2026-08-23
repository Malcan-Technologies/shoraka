import type { Request, Response } from "express";
import { getClientIp } from "../../../lib/http/request-utils";
import {
  PRODUCT_AUDIT_ACTOR_TYPE,
  PRODUCT_AUDIT_PORTAL,
  PRODUCT_AUDIT_SOURCE,
  type ProductAuditActorType,
  type ProductAuditPortal,
  type ProductAuditSource,
} from "./events";

export type ProductAuditContext = {
  actorType: ProductAuditActorType;
  actorUserId: string;
  organizationId?: string | null;
  organizationKind?: string | null;
  source: ProductAuditSource;
  portal?: ProductAuditPortal | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
};

export function auditContextFromAdminRequest(req: Request, res: Response): ProductAuditContext {
  const actorUserId = req.user?.user_id;
  if (!actorUserId) {
    throw new Error("Authenticated admin user is required to write product audit events.");
  }

  return {
    actorType: PRODUCT_AUDIT_ACTOR_TYPE.ADMIN,
    actorUserId,
    organizationId: null,
    organizationKind: null,
    source: PRODUCT_AUDIT_SOURCE.API,
    portal: PRODUCT_AUDIT_PORTAL.ADMIN,
    ipAddress: getClientIp(req) ?? null,
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    correlationId: typeof res.locals.correlationId === "string" ? res.locals.correlationId : null,
    idempotencyKey: null,
  };
}
