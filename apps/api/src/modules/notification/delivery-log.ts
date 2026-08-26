import type { Notification } from "@prisma/client";
import type { PortalType } from "../../lib/http/url-utils";

export type NotificationLogTargetType = "INVESTORS" | "ISSUERS" | "ALL_USERS";

/** Channel flags used to tally selected delivery, not SES success. */
export type NotificationDeliveryChannelFlags = Pick<
  Notification,
  "send_to_platform" | "send_to_email"
>;

export type NotificationDeliveryResult = NotificationDeliveryChannelFlags | null;

export interface SystemDeliveryLogInput {
  typeId: string;
  title: string;
  message: string;
  targetType: string;
  /** Attempted recipients for this logical batch (including channel-skipped). */
  recipientCount: number;
  results: NotificationDeliveryResult[];
  /** Stable SYSTEM batch key. Admin/manual rows leave this unset. */
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface DeliveryChannelCounts {
  deliveredPlatformCount: number;
  deliveredEmailCount: number;
}

/**
 * Count selected channels from created notification rows.
 * `delivered_email_count` is send_to_email=true (attempted email), not SES success.
 */
export function summarizeNotificationDelivery(
  results: NotificationDeliveryResult[]
): DeliveryChannelCounts {
  let deliveredPlatformCount = 0;
  let deliveredEmailCount = 0;
  for (const row of results) {
    if (!row) continue;
    if (row.send_to_platform) deliveredPlatformCount += 1;
    if (row.send_to_email) deliveredEmailCount += 1;
  }
  return { deliveredPlatformCount, deliveredEmailCount };
}

export function portalToNotificationLogTarget(
  portal: PortalType | string | null | undefined
): NotificationLogTargetType {
  if (portal === "issuer") return "ISSUERS";
  if (portal === "investor") return "INVESTORS";
  return "ALL_USERS";
}

export function notificationLogTargetToPortal(
  targetType: string | null | undefined
): PortalType | undefined {
  if (targetType === "ISSUERS") return "issuer";
  if (targetType === "INVESTORS") return "investor";
  return undefined;
}

/** Deterministic SYSTEM NotificationLog key. Never include log-time timestamps. */
export function systemNotificationLogKey(typeId: string, eventKey: string): string {
  return `system-log:${typeId}:${eventKey}`;
}

export function isNotificationLogUniqueConflict(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
  );
}
