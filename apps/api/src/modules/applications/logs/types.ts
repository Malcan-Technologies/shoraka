/**
 * Guide: docs/guides/admin/activity-timeline.md — Event types for application logs
 *
 * Event type is the single source of truth. level/target/action are deprecated.
 */

/** Canonical application log event types. Use these instead of level_target_action. */
export enum ApplicationLogEventType {
  APPLICATION_CREATED = "APPLICATION_CREATED",
  APPLICATION_SUBMITTED = "APPLICATION_SUBMITTED",
  APPLICATION_RESUBMITTED = "APPLICATION_RESUBMITTED",
  APPLICATION_APPROVED = "APPLICATION_APPROVED",
  APPLICATION_REJECTED = "APPLICATION_REJECTED",
  APPLICATION_WITHDRAWN = "APPLICATION_WITHDRAWN",
  APPLICATION_COMPLETED = "APPLICATION_COMPLETED",
  APPLICATION_RESET_TO_UNDER_REVIEW = "APPLICATION_RESET_TO_UNDER_REVIEW",
  SECTION_REVIEWED_APPROVED = "SECTION_REVIEWED_APPROVED",
  SECTION_REVIEWED_REJECTED = "SECTION_REVIEWED_REJECTED",
  SECTION_REVIEWED_AMENDMENT_REQUESTED = "SECTION_REVIEWED_AMENDMENT_REQUESTED",
  SECTION_REVIEWED_PENDING = "SECTION_REVIEWED_PENDING",
  ITEM_REVIEWED_APPROVED = "ITEM_REVIEWED_APPROVED",
  ITEM_REVIEWED_REJECTED = "ITEM_REVIEWED_REJECTED",
  ITEM_REVIEWED_AMENDMENT_REQUESTED = "ITEM_REVIEWED_AMENDMENT_REQUESTED",
  ITEM_REVIEWED_PENDING = "ITEM_REVIEWED_PENDING",
  CONTRACT_OFFER_SENT = "CONTRACT_OFFER_SENT",
  CONTRACT_OFFER_ACCEPTED = "CONTRACT_OFFER_ACCEPTED",
  CONTRACT_OFFER_REJECTED = "CONTRACT_OFFER_REJECTED",
  CONTRACT_OFFER_RETRACTED = "CONTRACT_OFFER_RETRACTED",
  CONTRACT_WITHDRAWN = "CONTRACT_WITHDRAWN",
  INVOICE_OFFER_SENT = "INVOICE_OFFER_SENT",
  INVOICE_OFFER_ACCEPTED = "INVOICE_OFFER_ACCEPTED",
  INVOICE_OFFER_REJECTED = "INVOICE_OFFER_REJECTED",
  INVOICE_OFFER_RETRACTED = "INVOICE_OFFER_RETRACTED",
  INVOICE_WITHDRAWN = "INVOICE_WITHDRAWN",
  OFFER_EXPIRED = "OFFER_EXPIRED",
  AMENDMENTS_SUBMITTED = "AMENDMENTS_SUBMITTED",
}

export enum ActivityPortal {
  ISSUER = "ISSUER",
  ADMIN = "ADMIN",
}

/** @deprecated Use eventType only. Kept for DB column writes. */
export enum ActivityLevel {
  APPLICATION = "APPLICATION",
  TAB = "TAB",
  ITEM = "ITEM",
}

/** @deprecated Use eventType only. Kept for DB column writes. */
export enum ActivityTarget {
  APPLICATION = "APPLICATION",
  FINANCIAL = "FINANCIAL",
  CONTRACT = "CONTRACT",
  INVOICE = "INVOICE",
  SUPPORTING_DOCUMENT = "SUPPORTING_DOCUMENT",
}

/** @deprecated Use eventType only. Kept for DB column writes. */
export enum ActivityAction {
  CREATED = "CREATED",
  SUBMITTED = "SUBMITTED",
  RESUBMITTED = "RESUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  REQUESTED_AMENDMENT = "REQUESTED_AMENDMENT",
  RESET = "RESET",
}

export type CreateApplicationLogParams = {
  userId: string;
  applicationId?: string;
  /** Required. Use ApplicationLogEventType enum. */
  eventType: ApplicationLogEventType | string;
  reviewCycle?: number;
  remark?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
  portal?: ActivityPortal;
  /** Extra fields for review audit (scope, scope_key, old_status, new_status) */
  metadata?: Record<string, unknown>;
};

