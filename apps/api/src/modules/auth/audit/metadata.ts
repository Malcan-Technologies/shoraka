import { z } from "zod";
import { ACCESS_AUDIT_EVENTS, type AccessAuditEventType } from "./events";

const snapshotFields = {
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
};

export const accessLoginAuditMetadataSchema = z.object({
  ...snapshotFields,
  loginMethod: z.literal("COGNITO_OAUTH"),
  sessionId: z.string().nullable().optional(),
  requestedRole: z.string().nullable().optional(),
  activeRole: z.string().nullable().optional(),
  roles: z.array(z.string()).optional(),
});

export const accessLogoutAuditMetadataSchema = z.object({
  ...snapshotFields,
  activeRole: z.string().nullable().optional(),
  roles: z.array(z.string()).optional(),
});

export type AccessLoginAuditMetadata = z.infer<typeof accessLoginAuditMetadataSchema>;
export type AccessLogoutAuditMetadata = z.infer<typeof accessLogoutAuditMetadataSchema>;

const metadataByEvent = {
  USER_SIGNED_UP: accessLoginAuditMetadataSchema,
  USER_LOGGED_IN: accessLoginAuditMetadataSchema,
  USER_LOGGED_OUT: accessLogoutAuditMetadataSchema,
} as const;

export function parseAccessAuditMetadata(
  eventType: AccessAuditEventType,
  metadata: unknown
): AccessLoginAuditMetadata | AccessLogoutAuditMetadata {
  return metadataByEvent[eventType].parse(metadata);
}

export function isAccessAuditEventType(
  value: string
): value is AccessAuditEventType {
  return (ACCESS_AUDIT_EVENTS as readonly string[]).includes(value);
}
