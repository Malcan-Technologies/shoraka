/**
 * Standardized writer for the existing `product_logs` table.
 *
 * Legacy columns and `metadata` are written exactly as origin/main wrote them (including the
 * `Prisma.JsonNull` sentinel used by `ProductLogRepository`). Product configuration is admin-only,
 * so the derived portal is always ADMIN.
 *
 * No actor name/email snapshot: `user_id` cascade-deletes with the User, so a snapshot here could
 * never be read.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  AUDIT_PORTAL,
  AUDIT_TARGET_TYPE,
  AuditRequestContext,
  AuditSource,
  resolveStandardAuditFields,
} from "../../lib/audit";

type ProductLogDb = Prisma.TransactionClient | typeof prisma;

export type CreateProductLogParams = {
  /** The acting admin. */
  userId: string;
  productId?: string | null;
  eventType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: string | null;
  /** Written through unchanged. Pass `Prisma.JsonNull` to keep the legacy explicit-null behaviour. */
  metadata?: Prisma.InputJsonValue | typeof Prisma.JsonNull;

  context?: AuditRequestContext | null;
  source?: AuditSource | null;
  correlationId?: string | null;
};

export async function createProductLogRow(
  params: CreateProductLogParams,
  db: ProductLogDb = prisma
) {
  const standard = resolveStandardAuditFields({
    context: params.context,
    actorUserId: params.userId,
    portal: AUDIT_PORTAL.ADMIN,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    correlationId: params.correlationId,
    source: params.source,
    targetType: params.productId ? AUDIT_TARGET_TYPE.PRODUCT : null,
    targetId: params.productId,
  });

  return db.productLog.create({
    data: {
      user_id: params.userId,
      product_id: params.productId ?? null,
      event_type: params.eventType,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      device_info: params.deviceInfo ?? null,
      metadata: params.metadata,

      actor_type: standard.actor_type,
      target_type: standard.target_type,
      target_id: standard.target_id,
      source: standard.source,
      portal: standard.portal,
      correlation_id: standard.correlation_id,
    },
  });
}
