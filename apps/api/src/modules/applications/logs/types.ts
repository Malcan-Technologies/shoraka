/**
 * Guide: docs/guides/admin/activity-timeline.md — Event types for application logs
 *
 * Event type is the single source of truth. level/target/action are deprecated.
 */

import type { AuditRequestContext, AuditSource } from "../../../lib/audit";

/** Canonical application log event types. Use these instead of level_target_action. */
export enum ApplicationLogEventType {
  APPLICATION_CREATED = "APPLICATION_CREATED",
  APPLICATION_PROCESSING_FEE_PAID = "APPLICATION_PROCESSING_FEE_PAID",
  /** Facility fee capture credited to the contract. Distinct from CONTRACT_FACILITY_FEE_WAIVED. */
  FACILITY_FEE_PAID = "FACILITY_FEE_PAID",
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
  /** Issuer submitted Step 1 acceptance documents and authorised representatives. */
  CONTRACT_OFFER_ACCEPTANCE_SUBMITTED = "CONTRACT_OFFER_ACCEPTANCE_SUBMITTED",
  /** Issuer resubmitted acceptance documents after CHANGES_REQUESTED. */
  CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED = "CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED",
  /** Admin approved acceptance docs and authorised representatives; admin can send signing links. */
  CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING = "CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING",
  CONTRACT_OFFER_ACCEPTED = "CONTRACT_OFFER_ACCEPTED",
  CONTRACT_OFFER_REJECTED = "CONTRACT_OFFER_REJECTED",
  CONTRACT_OFFER_RETRACTED = "CONTRACT_OFFER_RETRACTED",
  /** Revolving occupancy changed (draw reserved, funded true-up, or repayment released). */
  CONTRACT_FACILITY_OCCUPANCY_UPDATED = "CONTRACT_FACILITY_OCCUPANCY_UPDATED",
  /** Durable expiry after acceptance/signing deadline (entity → OFFER_EXPIRED). */
  CONTRACT_OFFER_EXPIRED = "CONTRACT_OFFER_EXPIRED",
  /** Admin restamped signing_expires_at after the signing clock passed. */
  CONTRACT_SIGNING_DEADLINE_EXTENDED = "CONTRACT_SIGNING_DEADLINE_EXTENDED",
  CONTRACT_OFFER_DECLINED = "CONTRACT_OFFER_DECLINED",
  CONTRACT_FACILITY_FEE_WAIVED = "CONTRACT_FACILITY_FEE_WAIVED",
  CONTRACT_FACILITY_DISABLED = "CONTRACT_FACILITY_DISABLED",
  CONTRACT_FACILITY_ENABLED = "CONTRACT_FACILITY_ENABLED",
  INVOICE_OFFER_SENT = "INVOICE_OFFER_SENT",
  /** Issuer submitted Step 1 acceptance documents and authorised representatives. */
  INVOICE_OFFER_ACCEPTANCE_SUBMITTED = "INVOICE_OFFER_ACCEPTANCE_SUBMITTED",
  /** Issuer resubmitted acceptance documents after CHANGES_REQUESTED. */
  INVOICE_OFFER_ACCEPTANCE_RESUBMITTED = "INVOICE_OFFER_ACCEPTANCE_RESUBMITTED",
  /** Admin approved acceptance docs and authorised representatives; admin can send signing links. */
  INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING = "INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING",
  INVOICE_OFFER_ACCEPTED = "INVOICE_OFFER_ACCEPTED",
  INVOICE_OFFER_REJECTED = "INVOICE_OFFER_REJECTED",
  INVOICE_OFFER_RETRACTED = "INVOICE_OFFER_RETRACTED",
  /** Durable expiry after acceptance/signing deadline (entity → OFFER_EXPIRED). */
  INVOICE_OFFER_EXPIRED = "INVOICE_OFFER_EXPIRED",
  /** Admin restamped signing_expires_at after the signing clock passed. */
  INVOICE_SIGNING_DEADLINE_EXTENDED = "INVOICE_SIGNING_DEADLINE_EXTENDED",
  INVOICE_WITHDRAWN = "INVOICE_WITHDRAWN",
  AMENDMENTS_SUBMITTED = "AMENDMENTS_SUBMITTED",
  SIGNING_PACKAGE_CREATED = "SIGNING_PACKAGE_CREATED",
  SIGNING_PACKAGE_SENT = "SIGNING_PACKAGE_SENT",
  /** Envelope rollup COMPLETED. Distinct from CONTRACT/INVOICE_OFFER_ACCEPTED. */
  SIGNING_PACKAGE_COMPLETED = "SIGNING_PACKAGE_COMPLETED",
  /** Signer declined; distinct from an admin/system void. */
  SIGNING_PACKAGE_DECLINED = "SIGNING_PACKAGE_DECLINED",
  /** Envelope expires_at elapsed while still active. */
  SIGNING_PACKAGE_EXPIRED = "SIGNING_PACKAGE_EXPIRED",
  SIGNING_PACKAGE_VOIDED = "SIGNING_PACKAGE_VOIDED",
  PAYMASTER_CREATED = "PAYMASTER_CREATED",
  PAYMASTER_LINKED_TO_ISSUER = "PAYMASTER_LINKED_TO_ISSUER",
  PAYMASTER_VERIFIED = "PAYMASTER_VERIFIED",
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
  /** Acting user when a human performed the change. Null for system/provider-derived rows. */
  userId: string | null;
  applicationId?: string | null;
  /** Required. Use ApplicationLogEventType enum. */
  eventType: ApplicationLogEventType | string;
  reviewCycle?: number;
  remark?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
  portal?: ActivityPortal | null;
  /** Extra fields for review audit (scope, scope_key, old_status, new_status) */
  metadata?: Record<string, unknown>;
  /** Human display reference (B). Never the application UUID. */
  applicationReference?: string | null;
  /** Facility display_reference (B). Distinct from contract_number. */
  contractReference?: string | null;
  /** Invoice display_reference (B). Distinct from invoice_number. */
  invoiceReference?: string | null;
  /** Note note_reference (B). Occupancy note-side events use this. */
  noteReference?: string | null;

  /**
   * Optional forensic context. When supplied it fills IP / user agent / correlation id / source /
   * actor type for call sites that do not pass them individually. Explicit per-field values above
   * always win.
   */
  context?: AuditRequestContext | null;
  /** Overrides the default `API` source (e.g. `SYSTEM_JOB` for expiry sweeps). */
  source?: AuditSource | null;
  /** Explicit occurred-at. Defaults to the DB `now()` default. */
  createdAt?: Date;
};

export type IssuerActivityLogContext = {
  context?: AuditRequestContext | null;
  ipAddress?: string;
  userAgent?: string;
};
