/**
 * Live-event visibility and lifecycle classification.
 *
 * Layers are mutually exclusive. HISTORICAL_READER events keep existing rows visible
 * but must not be advertised as current writers. DEV_ONLY events are never current
 * production writers.
 */

export const EVENT_LAYER = {
  USER_ACTIVITY: "USER_ACTIVITY",
  ORG_ACTIVITY: "ORG_ACTIVITY",
  APPLICATION_TIMELINE: "APPLICATION_TIMELINE",
  NOTE_TIMELINE: "NOTE_TIMELINE",
  ADMIN_ACTIVITY: "ADMIN_ACTIVITY",
  FORENSIC_ONLY: "FORENSIC_ONLY",
  LEGAL_ONLY: "LEGAL_ONLY",
  FINANCIAL_ONLY: "FINANCIAL_ONLY",
  SECURITY_ONLY: "SECURITY_ONLY",
  NOTIFICATION: "NOTIFICATION",
} as const;

export type EventLayer = (typeof EVENT_LAYER)[keyof typeof EVENT_LAYER];

export const EVENT_LIFECYCLE = {
  LIVE: "LIVE",
  HISTORICAL_READER: "HISTORICAL_READER",
  DEV_ONLY: "DEV_ONLY",
} as const;

export type EventLifecycle = (typeof EVENT_LIFECYCLE)[keyof typeof EVENT_LIFECYCLE];

export type EventCatalogueEntry = {
  layer: EventLayer;
  lifecycle: EventLifecycle;
  table: string;
  /** Shown on issuer/investor Activity (meaningful milestones). */
  userVisible: boolean;
  notes?: string;
};

function entry(
  layer: EventLayer,
  table: string,
  extras?: Partial<Pick<EventCatalogueEntry, "lifecycle" | "userVisible" | "notes">>
): EventCatalogueEntry {
  return {
    layer,
    table,
    lifecycle: extras?.lifecycle ?? EVENT_LIFECYCLE.LIVE,
    userVisible: extras?.userVisible ?? false,
    notes: extras?.notes,
  };
}

const USER = { userVisible: true as const };

export const EVENT_CATALOGUE: Record<string, EventCatalogueEntry> = {
  // --- application_logs ---
  APPLICATION_CREATED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  APPLICATION_PROCESSING_FEE_PAID: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  FACILITY_FEE_PAID: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  APPLICATION_SUBMITTED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  APPLICATION_RESUBMITTED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  APPLICATION_APPROVED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", {
    ...USER,
    lifecycle: EVENT_LIFECYCLE.HISTORICAL_READER,
    notes: "No live writer. Kept so existing rows still render.",
  }),
  APPLICATION_REJECTED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  APPLICATION_WITHDRAWN: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  APPLICATION_COMPLETED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  APPLICATION_RESET_TO_UNDER_REVIEW: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  SECTION_REVIEWED_APPROVED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  SECTION_REVIEWED_REJECTED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  SECTION_REVIEWED_AMENDMENT_REQUESTED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  SECTION_REVIEWED_PENDING: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs", {
    notes: "Live CTOS financial-reset writer.",
  }),
  ITEM_REVIEWED_APPROVED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  ITEM_REVIEWED_REJECTED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  ITEM_REVIEWED_AMENDMENT_REQUESTED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  ITEM_REVIEWED_PENDING: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  CONTRACT_OFFER_SENT: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  CONTRACT_OFFER_ACCEPTANCE_SUBMITTED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED: entry(
    EVENT_LAYER.APPLICATION_TIMELINE,
    "application_logs",
    USER
  ),
  CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  CONTRACT_OFFER_ACCEPTED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  CONTRACT_OFFER_REJECTED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", {
    ...USER,
    lifecycle: EVENT_LIFECYCLE.HISTORICAL_READER,
    notes: "No live writer. Current decline path is CONTRACT_OFFER_DECLINED.",
  }),
  CONTRACT_OFFER_RETRACTED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  CONTRACT_FACILITY_OCCUPANCY_UPDATED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", {
    ...USER,
    notes: "Application-layer occupancy. Note-layer twin is FACILITY_OCCUPANCY_UPDATED.",
  }),
  CONTRACT_OFFER_EXPIRED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  CONTRACT_SIGNING_DEADLINE_EXTENDED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  CONTRACT_OFFER_DECLINED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  CONTRACT_FACILITY_FEE_WAIVED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  CONTRACT_FACILITY_DISABLED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  CONTRACT_FACILITY_ENABLED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  PAYMASTER_CREATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs", {
    notes: "Issuer created a new Paymaster master as UNVERIFIED. Not customer visible.",
  }),
  PAYMASTER_LINKED_TO_ISSUER: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs", {
    notes: "New IssuerPaymasterLink on an existing master. Not written for last_used_at updates or the originating create.",
  }),
  PAYMASTER_VERIFIED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs", {
    notes: "Admin identity review UNVERIFIED → VERIFIED. Display as Paymaster Identity Verified. Not application approval.",
  }),
  PAYMASTER_IDENTITY_RESOLVED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs", {
    notes: "Admin overlaid verified Paymaster identity onto this application's submitted customer_details. Not customer visible.",
  }),
  INVOICE_OFFER_SENT: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  INVOICE_OFFER_ACCEPTANCE_SUBMITTED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  INVOICE_OFFER_ACCEPTANCE_RESUBMITTED: entry(
    EVENT_LAYER.APPLICATION_TIMELINE,
    "application_logs",
    USER
  ),
  INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  INVOICE_OFFER_ACCEPTED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  INVOICE_OFFER_REJECTED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  INVOICE_OFFER_RETRACTED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  INVOICE_OFFER_EXPIRED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  INVOICE_SIGNING_DEADLINE_EXTENDED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  INVOICE_WITHDRAWN: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  AMENDMENTS_SUBMITTED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  SIGNING_PACKAGE_CREATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),
  SIGNING_PACKAGE_SENT: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  SIGNING_PACKAGE_COMPLETED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  SIGNING_PACKAGE_DECLINED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  SIGNING_PACKAGE_EXPIRED: entry(EVENT_LAYER.APPLICATION_TIMELINE, "application_logs", USER),
  SIGNING_PACKAGE_VOIDED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "application_logs"),

  // --- onboarding_logs ---
  ONBOARDING_STARTED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs", USER),
  ONBOARDING_FEE_PAID: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs", USER),
  ONBOARDING_RESUMED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs"),
  ONBOARDING_STATUS_UPDATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "onboarding_logs", {
    notes: "Includes COD URL_GENERATED → PENDING_AMENDMENT forensic detail.",
  }),
  ONBOARDING_AMENDMENT_REQUIRED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs", {
    ...USER,
    notes: "Customer-facing amendment milestone. Does not expose COD/provider internals.",
  }),
  ONBOARDING_CANCELLED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs", USER),
  ONBOARDING_RESET: entry(EVENT_LAYER.ADMIN_ACTIVITY, "onboarding_logs"),
  ONBOARDING_REJECTED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs", USER),
  COD_REJECTED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs", USER),
  SOPHISTICATED_STATUS_UPDATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "onboarding_logs"),
  FINAL_APPROVAL_COMPLETED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs", USER),
  FORM_FILLED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "onboarding_logs"),
  ONBOARDING_APPROVED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs", USER),
  AML_APPROVED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "onboarding_logs"),
  TNC_APPROVED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "onboarding_logs"),
  SSM_APPROVED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "onboarding_logs"),
  PROFILE_UPDATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "onboarding_logs"),
  MEMBER_ADDED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs"),
  MEMBER_INVITED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs"),
  MEMBER_REMOVED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs"),
  MEMBER_ROLE_CHANGED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs"),
  MARC_ASSESSMENT_SAVED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "onboarding_logs"),
  EOD_APPROVED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "onboarding_logs"),
  EOD_REJECTED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "onboarding_logs"),
  EOD_WEBHOOK: entry(EVENT_LAYER.FORENSIC_ONLY, "onboarding_logs"),
  TNC_ACCEPTED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs", {
    lifecycle: EVENT_LIFECYCLE.HISTORICAL_READER,
    notes: "Seed/CSV only. Live writer is TNC_APPROVED.",
  }),
  KYC_APPROVED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs", {
    lifecycle: EVENT_LIFECYCLE.HISTORICAL_READER,
    notes: "Seed/CSV only. Live path is ONBOARDING_STATUS_UPDATED trigger KYC_APPROVED.",
  }),
  USER_COMPLETED: entry(EVENT_LAYER.ORG_ACTIVITY, "onboarding_logs", {
    lifecycle: EVENT_LIFECYCLE.HISTORICAL_READER,
    notes: "Historical trigger value, not a current event_type writer.",
  }),
  WEBHOOK_RECEIVED: entry(EVENT_LAYER.FORENSIC_ONLY, "onboarding_logs", {
    lifecycle: EVENT_LIFECYCLE.DEV_ONLY,
  }),
  WEBHOOK_APPROVED: entry(EVENT_LAYER.FORENSIC_ONLY, "onboarding_logs", {
    lifecycle: EVENT_LIFECYCLE.DEV_ONLY,
  }),
  WEBHOOK_REJECTED: entry(EVENT_LAYER.FORENSIC_ONLY, "onboarding_logs", {
    lifecycle: EVENT_LIFECYCLE.DEV_ONLY,
  }),
  WEBHOOK_PENDING_APPROVAL: entry(EVENT_LAYER.FORENSIC_ONLY, "onboarding_logs", {
    lifecycle: EVENT_LIFECYCLE.DEV_ONLY,
  }),
  WEBHOOK_LIVENESS_PASSED: entry(EVENT_LAYER.FORENSIC_ONLY, "onboarding_logs", {
    lifecycle: EVENT_LIFECYCLE.DEV_ONLY,
  }),
  WEBHOOK_FORM_FILLING: entry(EVENT_LAYER.FORENSIC_ONLY, "onboarding_logs", {
    lifecycle: EVENT_LIFECYCLE.DEV_ONLY,
  }),
  WEBHOOK_IN_PROGRESS: entry(EVENT_LAYER.FORENSIC_ONLY, "onboarding_logs", {
    lifecycle: EVENT_LIFECYCLE.DEV_ONLY,
  }),

  // --- note_events ---
  FAIL_FUNDING: entry(EVENT_LAYER.NOTE_TIMELINE, "note_events", USER),
  ACTIVATE: entry(EVENT_LAYER.NOTE_TIMELINE, "note_events", USER),
  WITHDRAWAL_COMPLETED: entry(EVENT_LAYER.NOTE_TIMELINE, "note_events", USER),
  NOTE_DEFAULT_MARKED: entry(EVENT_LAYER.NOTE_TIMELINE, "note_events", USER),
  NOTE_CREATED_FROM_INVOICE: entry(EVENT_LAYER.NOTE_TIMELINE, "note_events", USER),
  PUBLISH: entry(EVENT_LAYER.NOTE_TIMELINE, "note_events", USER),
  PAUSE_LISTING: entry(EVENT_LAYER.NOTE_TIMELINE, "note_events", USER),
  RESUME_LISTING: entry(EVENT_LAYER.NOTE_TIMELINE, "note_events", USER),
  CLOSE_FUNDING: entry(EVENT_LAYER.NOTE_TIMELINE, "note_events", USER),
  ISSUER_PAYMENT_SUBMITTED: entry(EVENT_LAYER.NOTE_TIMELINE, "note_events", USER),
  INVESTMENT_COMMITTED: entry(EVENT_LAYER.NOTE_TIMELINE, "note_events", USER),
  SETTLEMENT_POSTED: entry(EVENT_LAYER.NOTE_TIMELINE, "note_events", USER),
  FACILITY_OCCUPANCY_UPDATED: entry(EVENT_LAYER.NOTE_TIMELINE, "note_events", {
    notes: "Note-layer occupancy. Application-layer twin is CONTRACT_FACILITY_OCCUPANCY_UPDATED.",
  }),
  SETTLEMENT_PREVIEWED: entry(EVENT_LAYER.FORENSIC_ONLY, "note_events", {
    lifecycle: EVENT_LIFECYCLE.HISTORICAL_READER,
    notes: "Noisy preview. No longer written on the live path.",
  }),
  OVERDUE_LATE_CHARGE_CHECKED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events", {
    notes: "Written only when servicing status actually changes.",
  }),
  SHORAKA_ORDER_SUBMITTED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events", {
    notes: "Admin note timeline. Not issuer/investor Activity.",
  }),
  SHORAKA_CERTIFICATE_FETCHED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events", {
    notes: "Admin note timeline. Not issuer/investor Activity.",
  }),
  INVESTMENT_NOTE_CERTIFICATE_GENERATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events", {
    notes: "Islamic Investment Note Certificate artefact set READY. Not issuer/investor Activity.",
  }),
  INVESTMENT_NOTE_CERTIFICATE_REISSUED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events", {
    notes: "Admin regenerated a READY certificate as a new version. Not issuer/investor Activity.",
  }),
  INVESTMENT_NOTE_CERTIFICATE_PUBLISHED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events", {
    notes: "Admin published a regenerated certificate version for users. Not issuer/investor Activity.",
  }),
  SETTLEMENT_HIBAH_RECEIPT_GENERATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events", {
    notes: "Issuer Settlement & Hibah Receipt PDF READY. Not issuer/investor Activity.",
  }),
  SETTLEMENT_HIBAH_RECEIPT_REISSUED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events", {
    notes: "Admin regenerated a READY Settlement & Hibah Receipt as a new version. Not issuer/investor Activity.",
  }),
  SETTLEMENT_HIBAH_RECEIPT_PUBLISHED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events", {
    notes: "Admin published a regenerated Settlement & Hibah Receipt version. Not issuer/investor Activity.",
  }),
  INVESTMENT_SETTLEMENT_CONFIRMATION_GENERATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events", {
    notes: "Investor settlement confirmation PDFs READY for a posted settlement. Not issuer/investor Activity.",
  }),
  INVESTMENT_SETTLEMENT_CONFIRMATION_REISSUED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events", {
    notes: "Admin regenerated a READY investor settlement confirmation as a new version. Not issuer/investor Activity.",
  }),
  INVESTMENT_SETTLEMENT_CONFIRMATION_PUBLISHED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events", {
    notes: "Admin published a regenerated investor settlement confirmation. Not issuer/investor Activity.",
  }),
  ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  PAYMENT_APPROVED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  PAYMENT_REJECTED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  SETTLEMENT_APPROVED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  LATE_CHARGE_APPROVED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  SETTLEMENT_TRUSTEE_LETTER_GENERATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  SETTLEMENT_TRUSTEE_LETTER_SUBMITTED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  WITHDRAWAL_LETTER_GENERATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  WITHDRAWAL_SUBMITTED_TO_TRUSTEE: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  WITHDRAWAL_BENEFICIARY_UPDATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  WITHDRAWAL_TRUSTEE_EMAIL_SENT: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  SETTLEMENT_TRUSTEE_EMAIL_SENT: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  PAYMASTER_NOTICE_GENERATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  PAYMASTER_NOTICE_SENT: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  PAYMASTER_NOTICE_UPLOADED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  PAYMASTER_ACKNOWLEDGEMENT_UPLOADED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  PAYMASTER_ACKNOWLEDGEMENT_CONFIRMED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  PROSPECTUS_REVIEW_CREATE: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  PROSPECTUS_REVIEW_DRAFT_UPDATE: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  PROSPECTUS_REVIEW_APPROVE: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  PROSPECTUS_APPROVAL_INVALIDATED_SOURCE: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),
  PROSPECTUS_APPROVAL_INVALIDATED_EDIT: entry(EVENT_LAYER.ADMIN_ACTIVITY, "note_events"),

  // --- product_logs ---
  PRODUCT_CREATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "product_logs"),
  PRODUCT_UPDATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "product_logs"),
  PRODUCT_DELETED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "product_logs"),
  PRODUCT_INACTIVATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "product_logs", {
    lifecycle: EVENT_LIFECYCLE.HISTORICAL_READER,
    notes: "setInactive is unmounted. Versioning writes PRODUCT_UPDATED instead.",
  }),
  PRODUCT_REACTIVATED: entry(EVENT_LAYER.ADMIN_ACTIVITY, "product_logs", {
    lifecycle: EVENT_LIFECYCLE.HISTORICAL_READER,
    notes: "restoreProduct is unmounted.",
  }),

  // --- gateway_payment_events ---
  CREATED: entry(EVENT_LAYER.FINANCIAL_ONLY, "gateway_payment_events"),
  COMPLETED: entry(EVENT_LAYER.FINANCIAL_ONLY, "gateway_payment_events"),
  GATEWAY_PAYMENT_COMPLETED: entry(EVENT_LAYER.FINANCIAL_ONLY, "gateway_payment_events"),
  FAILED: entry(EVENT_LAYER.FINANCIAL_ONLY, "gateway_payment_events"),
  EXPIRED: entry(EVENT_LAYER.FINANCIAL_ONLY, "gateway_payment_events"),
  REFUNDED: entry(EVENT_LAYER.FINANCIAL_ONLY, "gateway_payment_events"),
  OVERRIDE_PROPOSED: entry(EVENT_LAYER.FINANCIAL_ONLY, "gateway_payment_events", {
    lifecycle: EVENT_LIFECYCLE.HISTORICAL_READER,
    notes: "No live writer.",
  }),
  OVERRIDE_APPROVED: entry(EVENT_LAYER.FINANCIAL_ONLY, "gateway_payment_events", {
    lifecycle: EVENT_LIFECYCLE.HISTORICAL_READER,
  }),
  OVERRIDE_REJECTED: entry(EVENT_LAYER.FINANCIAL_ONLY, "gateway_payment_events", {
    lifecycle: EVENT_LIFECYCLE.HISTORICAL_READER,
  }),

  // --- access / security ---
  LOGIN: entry(EVENT_LAYER.SECURITY_ONLY, "access_logs"),
  LOGOUT: entry(EVENT_LAYER.SECURITY_ONLY, "access_logs"),
  SIGNUP: entry(EVENT_LAYER.SECURITY_ONLY, "access_logs"),
  ROLE_ADDED: entry(EVENT_LAYER.SECURITY_ONLY, "security_logs"),
  ROLE_CREATED: entry(EVENT_LAYER.SECURITY_ONLY, "security_logs"),
  ROLE_REMOVED: entry(EVENT_LAYER.SECURITY_ONLY, "security_logs"),
  ROLE_PERMISSIONS_UPDATED: entry(EVENT_LAYER.SECURITY_ONLY, "security_logs"),
  ROLE_SWITCHED: entry(EVENT_LAYER.SECURITY_ONLY, "security_logs"),
  EMAIL_VERIFIED: entry(EVENT_LAYER.SECURITY_ONLY, "security_logs"),
  ACCOUNT_LOCKED: entry(EVENT_LAYER.SECURITY_ONLY, "security_logs"),
  PASSWORD_CHANGED: entry(EVENT_LAYER.SECURITY_ONLY, "security_logs"),
  INVITATION_REVOKED: entry(EVENT_LAYER.SECURITY_ONLY, "security_logs"),
  PLATFORM_FINANCE_SETTINGS_UPDATED: entry(EVENT_LAYER.SECURITY_ONLY, "security_logs"),

  // --- legal (not Activity) ---
  LEGAL_DOCUMENT_CREATED: entry(EVENT_LAYER.LEGAL_ONLY, "legal_document_audit_logs"),
  LEGAL_DOCUMENT_UPDATED: entry(EVENT_LAYER.LEGAL_ONLY, "legal_document_audit_logs"),
  LEGAL_VERSION_UPLOADED: entry(EVENT_LAYER.LEGAL_ONLY, "legal_document_audit_logs"),
  LEGAL_VERSION_FILE_REPLACED: entry(EVENT_LAYER.LEGAL_ONLY, "legal_document_audit_logs"),
  LEGAL_VERSION_PUBLISHED: entry(EVENT_LAYER.LEGAL_ONLY, "legal_document_audit_logs"),
  LEGAL_VERSION_ARCHIVED: entry(EVENT_LAYER.LEGAL_ONLY, "legal_document_audit_logs"),
  LEGAL_VERSION_RESTORED: entry(EVENT_LAYER.LEGAL_ONLY, "legal_document_audit_logs"),
  LEGAL_DOCUMENT_ACCEPTANCE: entry(EVENT_LAYER.LEGAL_ONLY, "legal_document_acceptances"),
  LEGAL_EXTERNAL_ACCEPTANCE: entry(EVENT_LAYER.LEGAL_ONLY, "legal_external_acceptances"),
  GENERATED_DOCUMENT_EVIDENCE: entry(EVENT_LAYER.LEGAL_ONLY, "generated_document_evidence"),
};

export function catalogueEntry(eventType: string): EventCatalogueEntry | undefined {
  return EVENT_CATALOGUE[eventType];
}

export function eventTypesFor(filter: {
  table?: string;
  layer?: EventLayer;
  userVisible?: boolean;
  includeHistoricalReaders?: boolean;
}): string[] {
  const includeHistorical = filter.includeHistoricalReaders ?? true;
  return Object.entries(EVENT_CATALOGUE)
    .filter(([_, entry]) => {
      if (filter.table && entry.table !== filter.table) return false;
      if (filter.layer && entry.layer !== filter.layer) return false;
      if (filter.userVisible != null && entry.userVisible !== filter.userVisible) return false;
      if (entry.lifecycle === EVENT_LIFECYCLE.DEV_ONLY) return false;
      if (!includeHistorical && entry.lifecycle === EVENT_LIFECYCLE.HISTORICAL_READER) return false;
      return true;
    })
    .map(([eventType]) => eventType);
}

export function liveWriterEventTypes(): string[] {
  return Object.entries(EVENT_CATALOGUE)
    .filter(([, entry]) => entry.lifecycle === EVENT_LIFECYCLE.LIVE)
    .map(([eventType]) => eventType);
}

export function historicalReaderEventTypes(): string[] {
  return Object.entries(EVENT_CATALOGUE)
    .filter(([, entry]) => entry.lifecycle === EVENT_LIFECYCLE.HISTORICAL_READER)
    .map(([eventType]) => eventType);
}

export function userVisibleApplicationEventTypes(): string[] {
  return eventTypesFor({
    table: "application_logs",
    userVisible: true,
    includeHistoricalReaders: true,
  });
}

export function userVisibleOrganizationEventTypes(): string[] {
  return eventTypesFor({
    table: "onboarding_logs",
    layer: EVENT_LAYER.ORG_ACTIVITY,
    userVisible: true,
    includeHistoricalReaders: false,
  });
}

export function adminOrganizationEventTypes(): string[] {
  return eventTypesFor({
    table: "onboarding_logs",
    includeHistoricalReaders: false,
  }).filter((eventType) => EVENT_CATALOGUE[eventType].layer !== EVENT_LAYER.FORENSIC_ONLY);
}
