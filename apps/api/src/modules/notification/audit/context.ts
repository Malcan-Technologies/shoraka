import type { Request, Response } from "express";
import { getClientIp } from "../../../lib/http/request-utils";
import {
  NOTIFICATION_BROADCAST_AUDIT_ACTOR_TYPE,
  NOTIFICATION_BROADCAST_AUDIT_PORTAL,
  NOTIFICATION_BROADCAST_AUDIT_SOURCE,
  type NotificationBroadcastAuditActorType,
  type NotificationBroadcastAuditPortal,
  type NotificationBroadcastAuditSource,
} from "./events";

export type NotificationBroadcastAuditContext = {
  actorType: NotificationBroadcastAuditActorType;
  actorUserId: string;
  organizationId: null;
  organizationKind: null;
  source: NotificationBroadcastAuditSource;
  portal: NotificationBroadcastAuditPortal;
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

export function auditContextFromAdminRequest(
  req: Request,
  res: Response
): NotificationBroadcastAuditContext {
  const actorUserId = req.user?.user_id;
  if (!actorUserId) {
    throw new Error("Authenticated admin user is required to write notification broadcast audit events.");
  }

  return {
    actorType: NOTIFICATION_BROADCAST_AUDIT_ACTOR_TYPE.ADMIN,
    actorUserId,
    organizationId: null,
    organizationKind: null,
    source: NOTIFICATION_BROADCAST_AUDIT_SOURCE.API,
    portal: NOTIFICATION_BROADCAST_AUDIT_PORTAL.ADMIN,
    ipAddress: getClientIp(req) ?? null,
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    correlationId: correlationIdFrom(req, res),
    idempotencyKey: null,
  };
}
