/**
 * Derives the standard audit target for a note event from the event type and the metadata the
 * writer already supplies. Purely derivative — nothing is invented, nothing existing changes.
 */

import { Prisma } from "@prisma/client";
import { AUDIT_TARGET_TYPE, AuditTargetType } from "../../lib/audit";

function metaString(metadata: unknown, ...keys: string[]): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export function resolveNoteEventTarget(
  eventType: string,
  metadata?: Prisma.InputJsonValue | Record<string, unknown> | null
): { targetType: AuditTargetType; targetId: string | null } {
  if (eventType === "INVESTMENT_COMMITTED") {
    return {
      targetType: AUDIT_TARGET_TYPE.NOTE_INVESTMENT,
      targetId: metaString(metadata, "investmentId"),
    };
  }

  if (eventType.startsWith("SHORAKA_")) {
    return {
      targetType: AUDIT_TARGET_TYPE.SHORAKA_ORDER,
      targetId: metaString(metadata, "trade_order_id", "tradeOrderId"),
    };
  }

  if (eventType.startsWith("WITHDRAWAL_") || eventType.endsWith("WITHDRAWAL_CREATED")) {
    return {
      targetType: AUDIT_TARGET_TYPE.WITHDRAWAL,
      targetId: metaString(metadata, "withdrawalId"),
    };
  }

  if (eventType.startsWith("SETTLEMENT_")) {
    return {
      targetType: AUDIT_TARGET_TYPE.NOTE_SETTLEMENT,
      targetId: metaString(metadata, "settlementId"),
    };
  }

  if (eventType.startsWith("PAYMENT_") || eventType === "ISSUER_PAYMENT_SUBMITTED") {
    return {
      targetType: AUDIT_TARGET_TYPE.NOTE_PAYMENT,
      targetId: metaString(metadata, "paymentId"),
    };
  }

  if (eventType.startsWith("PROSPECTUS_")) {
    return {
      targetType: AUDIT_TARGET_TYPE.NOTE_PROSPECTUS,
      targetId: metaString(metadata, "publicationId", "reviewId"),
    };
  }

  return { targetType: AUDIT_TARGET_TYPE.NOTE, targetId: null };
}
