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
  portal?: string
}

