export const ACCESS_AUDIT_EVENTS = [
  "USER_SIGNED_UP",
  "USER_LOGGED_IN",
  "USER_LOGGED_OUT",
] as const;

export type AccessAuditEventType = (typeof ACCESS_AUDIT_EVENTS)[number];

export const ACCESS_AUDIT_TARGET_TYPE = "USER" as const;

export function isAccessAuditEventType(value: string): value is AccessAuditEventType {
  return (ACCESS_AUDIT_EVENTS as readonly string[]).includes(value);
}
