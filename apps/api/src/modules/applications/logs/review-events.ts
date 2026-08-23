/**
 * Standardized writer for the existing `application_review_events` table.
 *
 * This table is read by the admin application detail "Recent Activity" card, which selects only
 * `event_type`, `scope_key`, `new_status`, `remark` and `created_at`. Those columns are written
 * exactly as origin/main wrote them — in particular `remark` stays the first-class historical copy
 * of the reviewer remark. Everything new goes into additive nullable columns the card never reads.
 *
 * Rows are always written inside the same transaction as the review/offer state change.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  AUDIT_PORTAL,
  AUDIT_TARGET_TYPE,
  AuditRequestContext,
  AuditSource,
  AuditTargetType,
  resolveStandardAuditFields,
} from "../../../lib/audit";

type ReviewEventDb = Prisma.TransactionClient | typeof prisma;

export type CreateApplicationReviewEventParams = {
  applicationId: string;
  eventType: string;
  newStatus: string;
  scope?: string | null;
  scopeKey?: string | null;
  previousStatus?: string | null;
  reviewerUserId?: string | null;
  remark?: string | null;

  context?: AuditRequestContext | null;
  source?: AuditSource | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
  targetType?: AuditTargetType | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

function resolveReviewEventTarget(params: CreateApplicationReviewEventParams): {
  targetType: AuditTargetType;
  targetId: string;
} {
  if (params.scopeKey) {
    return {
      targetType:
        params.scope === "item"
          ? AUDIT_TARGET_TYPE.APPLICATION_ITEM
          : AUDIT_TARGET_TYPE.APPLICATION_SECTION,
      targetId: params.scopeKey,
    };
  }
  return { targetType: AUDIT_TARGET_TYPE.APPLICATION, targetId: params.applicationId };
}

export async function createApplicationReviewEventRow(
  params: CreateApplicationReviewEventParams,
  db: ReviewEventDb = prisma
) {
  const target = resolveReviewEventTarget(params);
  const standard = resolveStandardAuditFields({
    context: params.context,
    actorUserId: params.reviewerUserId,
    // Review events are only ever produced by admin review actions.
    portal: AUDIT_PORTAL.ADMIN,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    correlationId: params.correlationId,
    source: params.source,
    targetType: params.targetType ?? target.targetType,
    targetId: params.targetId ?? target.targetId,
  });

  return db.applicationReviewEvent.create({
    data: {
      application_id: params.applicationId,
      event_type: params.eventType,
      scope: params.scope ?? null,
      scope_key: params.scopeKey ?? null,
      old_status: params.previousStatus ?? null,
      new_status: params.newStatus,
      reviewer_user_id: params.reviewerUserId ?? null,
      remark: params.remark ?? null,

      actor_type: standard.actor_type,
      source: standard.source,
      portal: standard.portal,
      ip_address: standard.ip_address,
      user_agent: standard.user_agent,
      correlation_id: standard.correlation_id,
      metadata: params.metadata,
    },
  });
}
