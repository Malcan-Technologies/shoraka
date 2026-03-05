export enum ActivityLevel {
  APPLICATION = "APPLICATION",
  TAB = "TAB",
  ITEM = "ITEM",
}

export enum ActivityTarget {
  APPLICATION = "APPLICATION",
  FINANCIAL = "FINANCIAL",
  CONTRACT = "CONTRACT",
  INVOICE = "INVOICE",
  SUPPORTING_DOCUMENT = "SUPPORTING_DOCUMENT",
}

export enum ActivityAction {
  CREATED = "CREATED",
  SUBMITTED = "SUBMITTED",
  RESUBMITTED = "RESUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  REQUESTED_AMENDMENT = "REQUESTED_AMENDMENT",
  RESET = "RESET",
}

export enum ActivityPortal {
  ISSUER = "ISSUER",
  ADMIN = "ADMIN"
}

export type CreateApplicationLogParams = {
  userId: string
  applicationId?: string
  level?: ActivityLevel
  target?: ActivityTarget
  action?: ActivityAction
  reviewCycle?: number
  remark?: string
  entityId?: string
  ipAddress?: string
  userAgent?: string
  deviceInfo?: string
  portal?: ActivityPortal
  /** Override event_type when level/target/action don't fit (e.g. SECTION_REVIEWED) */
  eventType?: string
  /** Extra fields for review audit (scope, scope_key, old_status, new_status) */
  metadata?: Record<string, unknown>
}

