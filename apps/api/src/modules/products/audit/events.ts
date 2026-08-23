export const PRODUCT_AUDIT_EVENTS = [
  "PRODUCT_CREATED",
  "PRODUCT_UPDATED",
  "PRODUCT_INACTIVATED",
  "PRODUCT_REACTIVATED",
  "PRODUCT_DELETED",
] as const;

export type ProductAuditEventType = (typeof PRODUCT_AUDIT_EVENTS)[number];

export const PRODUCT_AUDIT_TARGET_TYPE = "PRODUCT" as const;

export const PRODUCT_AUDIT_ACTOR_TYPE = {
  ADMIN: "ADMIN",
} as const;

export const PRODUCT_AUDIT_SOURCE = {
  API: "API",
} as const;

export const PRODUCT_AUDIT_PORTAL = {
  ADMIN: "ADMIN",
} as const;

export type ProductAuditActorType = (typeof PRODUCT_AUDIT_ACTOR_TYPE)[keyof typeof PRODUCT_AUDIT_ACTOR_TYPE];
export type ProductAuditSource = (typeof PRODUCT_AUDIT_SOURCE)[keyof typeof PRODUCT_AUDIT_SOURCE];
export type ProductAuditPortal = (typeof PRODUCT_AUDIT_PORTAL)[keyof typeof PRODUCT_AUDIT_PORTAL];
