import { z } from "zod";
import {
  NOTIFICATION_BROADCAST_AUDIT_EVENTS,
  NOTIFICATION_BROADCAST_CHANNEL_MODE,
  type NotificationBroadcastAuditEventType,
} from "./events";

const portalTargetSchema = z.enum(["INVESTOR", "ISSUER"]);

export const notificationBroadcastProcessedAuditMetadataSchema = z
  .object({
    notificationTypeId: z.string().min(1),
    notificationTypeName: z.string().min(1),
    portalTargets: z.array(portalTargetSchema),
    audienceType: z.string().min(1),
    groupId: z.string().nullable(),
    targetedCount: z.number().int().min(0),
    createdCount: z.number().int().min(0),
    skippedCount: z.number().int().min(0),
    failedCount: z.number().int().min(0),
    title: z.string(),
    message: z.string(),
    channelMode: z.enum([
      NOTIFICATION_BROADCAST_CHANNEL_MODE.EXPLICIT_OVERRIDE,
      NOTIFICATION_BROADCAST_CHANNEL_MODE.TYPE_AND_USER_PREFERENCES,
    ]),
    sendToPlatform: z.boolean().nullable(),
    sendToEmail: z.boolean().nullable(),
    linkPath: z.string().nullable(),
    expiresAt: z.string().datetime().nullable(),
    actorName: z.string().nullable(),
    actorEmail: z.string().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.createdCount + data.skippedCount + data.failedCount !== data.targetedCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "createdCount + skippedCount + failedCount must equal targetedCount",
        path: ["targetedCount"],
      });
    }

    if (data.channelMode === NOTIFICATION_BROADCAST_CHANNEL_MODE.TYPE_AND_USER_PREFERENCES) {
      if (data.sendToPlatform !== null || data.sendToEmail !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "sendToPlatform and sendToEmail must be null when channelMode is TYPE_AND_USER_PREFERENCES",
          path: ["channelMode"],
        });
      }
    }
  });

export type NotificationBroadcastProcessedAuditMetadata = z.infer<
  typeof notificationBroadcastProcessedAuditMetadataSchema
>;

const metadataByEvent = {
  NOTIFICATION_BROADCAST_PROCESSED: notificationBroadcastProcessedAuditMetadataSchema,
} as const;

export function parseNotificationBroadcastAuditMetadata(
  eventType: NotificationBroadcastAuditEventType,
  metadata: unknown
): NotificationBroadcastProcessedAuditMetadata {
  return metadataByEvent[eventType].parse(metadata);
}

export function isNotificationBroadcastAuditEventType(
  value: string
): value is NotificationBroadcastAuditEventType {
  return (NOTIFICATION_BROADCAST_AUDIT_EVENTS as readonly string[]).includes(value);
}
