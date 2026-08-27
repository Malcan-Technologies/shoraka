/**
 * Guide: docs/guides/admin/activity-timeline.md — Application log creation, remark at top-level, metadata usage
 *
 * Legacy columns (user_id, remark, entity_id, portal, review_cycle, metadata, ip/ua/device) are
 * written exactly as before, and `metadata` is never rewritten. The standard forensic columns are
 * derived additively into dedicated nullable columns. No formatter, visibility rule or export
 * projects them: activity readers and export serializers enumerate their columns explicitly, and the
 * only generic rendering in the admin UI iterates `metadata`, which is preserved byte-for-byte.
 *
 * Every standard field is derived from data the caller already holds — this writer issues no extra
 * query. That matters because many callers are inside a business transaction, and several wrap the
 * call in a best-effort try/catch where a failed lookup would silently drop the audit row.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { resolveStandardAuditFields } from "../../../lib/audit";
import { mergeDisplayReferences } from "../../../lib/audit/display-references";
import { CreateApplicationLogParams } from "./types";
import { resolveApplicationLogTarget } from "./audit-fields";

type ApplicationLogDb = Prisma.TransactionClient | typeof prisma;

export async function createApplicationLog(
  params: CreateApplicationLogParams,
  db: ApplicationLogDb = prisma
) {
  const applicationId = params.applicationId ?? null;
  const entityId = params.entityId ?? null;
  const { targetType, targetId } = resolveApplicationLogTarget(params.eventType, {
    applicationId,
    entityId,
    metadata: params.metadata,
  });

  const standard = resolveStandardAuditFields({
    context: params.context,
    actorUserId: params.userId,
    portal: params.portal,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    source: params.source,
    targetType,
    targetId,
  });

  const metadata = mergeDisplayReferences(params.metadata, {
    applicationReference: params.applicationReference,
    contractReference: params.contractReference,
    invoiceReference: params.invoiceReference,
  });

  return db.applicationLog.create({
    data: {
      user_id: params.userId,
      application_id: applicationId,
      event_type: params.eventType,
      level: null,
      target: null,
      action: null,
      review_cycle: params.reviewCycle ?? null,
      remark: params.remark ?? null,
      entity_id: entityId,
      ip_address: standard.ip_address,
      user_agent: standard.user_agent,
      device_info: params.deviceInfo ?? null,
      portal: params.portal ?? null,
      // Metadata is passed through byte-for-byte except additive display-reference snapshots.
      // Admin timelines gate the "View details" expander on metadata being truthy and render
      // some metadata generically, so extra keys are visible.
      metadata: metadata ?? null,
      ...(params.createdAt ? { created_at: params.createdAt } : {}),

      actor_type: standard.actor_type,
      target_type: standard.target_type,
      target_id: standard.target_id,
      source: standard.source,
      correlation_id: standard.correlation_id,
    } as any,
  });
}
