/**
 * Derives the standard audit target for an application log row from the event type and the
 * metadata the writer already supplies. Purely derivative — no value is invented and no existing
 * field is modified.
 */

import { AUDIT_TARGET_TYPE, AuditTargetType } from "../../../lib/audit";

type TargetSource = {
  applicationId?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

function metaString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function resolveApplicationLogTarget(
  eventType: string,
  source: TargetSource
): { targetType: AuditTargetType | null; targetId: string | null } {
  const { applicationId, entityId, metadata } = source;

  if (eventType.startsWith("SECTION_REVIEWED_")) {
    return {
      targetType: AUDIT_TARGET_TYPE.APPLICATION_SECTION,
      targetId: metaString(metadata, "scope_key") ?? entityId ?? applicationId ?? null,
    };
  }

  if (eventType.startsWith("ITEM_REVIEWED_")) {
    return {
      targetType: AUDIT_TARGET_TYPE.APPLICATION_ITEM,
      targetId: entityId ?? metaString(metadata, "scope_key") ?? applicationId ?? null,
    };
  }

  if (eventType.startsWith("SIGNING_PACKAGE_")) {
    return {
      targetType: AUDIT_TARGET_TYPE.SIGNING_ENVELOPE,
      targetId: entityId ?? metaString(metadata, "envelope_id") ?? applicationId ?? null,
    };
  }

  if (eventType.startsWith("CONTRACT_")) {
    return {
      targetType: AUDIT_TARGET_TYPE.CONTRACT,
      targetId: metaString(metadata, "contract_id") ?? entityId ?? applicationId ?? null,
    };
  }

  if (eventType.startsWith("INVOICE_")) {
    return {
      targetType: AUDIT_TARGET_TYPE.INVOICE,
      targetId: metaString(metadata, "invoice_id") ?? entityId ?? applicationId ?? null,
    };
  }

  return {
    targetType: AUDIT_TARGET_TYPE.APPLICATION,
    targetId: applicationId ?? entityId ?? null,
  };
}
