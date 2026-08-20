import type { PaymentAuditLog, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import type { PaymentAuditLogDto } from "@cashsouk/types";
import { isPaymentAuditEventType } from "./events";

function metadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function toPaymentAuditLogDto(row: PaymentAuditLog): PaymentAuditLogDto {
  const metadata = metadataRecord(row.metadata);
  const eventType = isPaymentAuditEventType(row.event_type) ? row.event_type : row.event_type;
  return {
    id: row.id,
    gatewayPaymentId: row.gateway_payment_id,
    eventType,
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    actor: {
      type: row.actor_type,
      userId: row.actor_user_id,
      displayName: stringOrNull(metadata.actorName),
      email: stringOrNull(metadata.actorEmail),
    },
    organizationId: row.organization_id,
    organizationKind: row.organization_kind,
    target: { type: row.target_type, id: row.target_id },
    source: row.source,
    portal: row.portal,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    correlationId: row.correlation_id,
    metadata,
  };
}

export class PaymentAuditLogReader {
  async listByGatewayPaymentId(
    gatewayPaymentId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<PaymentAuditLogDto[]> {
    const rows = await db.paymentAuditLog.findMany({
      where: { gateway_payment_id: gatewayPaymentId },
      orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
    });
    return rows.map(toPaymentAuditLogDto);
  }

  async listByTarget(
    targetType: string,
    targetId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<PaymentAuditLogDto[]> {
    const rows = await db.paymentAuditLog.findMany({
      where: { target_type: targetType, target_id: targetId },
      orderBy: [{ occurred_at: "desc" }, { id: "desc" }],
    });
    return rows.map(toPaymentAuditLogDto);
  }
}

export const paymentAuditLogReader = new PaymentAuditLogReader();
