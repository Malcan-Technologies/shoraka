export type ActivityAudience = "admin" | "issuer" | "investor";

export type ActivityVisibilityContext = {
  organizationKind?: string | null;
  organizationType?: string | null;
  organizationId?: string | null;
  ownerOrganizationId?: string | null;
  noteVisibleToIssuer?: boolean;
  investorCommitted?: boolean;
  settlementHasInvestorAllocation?: boolean;
};

const AMENDMENT_REQUIRED_STATUSES = new Set([
  "REQUEST_AMENDMENT",
  "AMENDMENT_REQUESTED",
]);

const DIRECTOR_KYC_VISIBLE_STATUSES = new Set([
  "APPROVED",
  "REJECTED",
  "ACTION_REQUIRED",
]);

const INVESTOR_MATERIAL_SERVICING_STATUSES = new Set(["LATE", "ARREARS", "DEFAULTED"]);

const OFFER_LIFECYCLE_EVENTS = [
  "CONTRACT_OFFER_SENT",
  "CONTRACT_OFFER_RETRACTED",
  "CONTRACT_SIGNING_DEADLINE_EXTENDED",
  "CONTRACT_OFFER_EXPIRED",
  "CONTRACT_ACCEPTANCE_SUBMITTED",
  "CONTRACT_ACCEPTANCE_RESUBMITTED",
  "CONTRACT_ACCEPTANCE_CHANGES_REQUESTED",
  "CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING",
  "CONTRACT_OFFER_ACCEPTED",
  "CONTRACT_OFFER_REJECTED",
  "CONTRACT_WITHDRAWN",
  "INVOICE_OFFER_SENT",
  "INVOICE_OFFER_RETRACTED",
  "INVOICE_SIGNING_DEADLINE_EXTENDED",
  "INVOICE_OFFER_EXPIRED",
  "INVOICE_ACCEPTANCE_SUBMITTED",
  "INVOICE_ACCEPTANCE_RESUBMITTED",
  "INVOICE_ACCEPTANCE_CHANGES_REQUESTED",
  "INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING",
  "INVOICE_OFFER_ACCEPTED",
  "INVOICE_OFFER_REJECTED",
  "INVOICE_WITHDRAWN",
] as const;

const APPLICATION_ADMIN_SHOW = new Set<string>([
  "APPLICATION_CREATED",
  "APPLICATION_SUBMITTED",
  "APPLICATION_REVIEW_STARTED",
  "APPLICATION_RESUBMITTED",
  "APPLICATION_AMENDMENTS_REQUESTED",
  "APPLICATION_REOPENED_FOR_REVIEW",
  "APPLICATION_WITHDRAWN",
  "APPLICATION_REJECTED",
  "APPLICATION_COMPLETED",
  ...OFFER_LIFECYCLE_EVENTS,
  "CONTRACT_FACILITY_OCCUPANCY_UPDATED",
]);

const APPLICATION_ISSUER_SHOW = new Set<string>([
  "APPLICATION_CREATED",
  "APPLICATION_SUBMITTED",
  "APPLICATION_RESUBMITTED",
  "APPLICATION_AMENDMENTS_REQUESTED",
  "APPLICATION_REOPENED_FOR_REVIEW",
  "APPLICATION_WITHDRAWN",
  "APPLICATION_REJECTED",
  "APPLICATION_COMPLETED",
  ...OFFER_LIFECYCLE_EVENTS,
]);

const SIGNING_ADMIN_SHOW = new Set<string>([
  "SIGNING_PACKAGE_CREATED",
  "SIGNING_PACKAGE_SENT",
  "SIGNING_PACKAGE_COMPLETED",
  "SIGNING_PACKAGE_VOIDED",
  "SIGNING_PACKAGE_DECLINED",
  "SIGNING_PACKAGE_EXPIRED",
  "SIGNING_RECIPIENT_COMPLETED",
  "SIGNING_RECIPIENT_DECLINED",
  "SIGNING_EKYC_FAILED",
]);

const SIGNING_ISSUER_SHOW = new Set<string>([
  "SIGNING_PACKAGE_SENT",
  "SIGNING_PACKAGE_COMPLETED",
  "SIGNING_PACKAGE_VOIDED",
  "SIGNING_PACKAGE_DECLINED",
  "SIGNING_PACKAGE_EXPIRED",
  "SIGNING_RECIPIENT_DECLINED",
]);

const NOTE_ISSUER_SHOW = new Set<string>([
  "NOTE_CREATED",
  "NOTE_PUBLISHED",
  "NOTE_UNPUBLISHED",
  "NOTE_CAMPAIGN_PAUSED",
  "NOTE_CAMPAIGN_RESUMED",
  "NOTE_FUNDING_CLOSED",
  "NOTE_FUNDING_FAILED",
  "NOTE_ACTIVATED",
  "NOTE_SERVICING_STATUS_CHANGED",
  "NOTE_MARKED_DEFAULT",
  "DISBURSEMENT_COMPLETED",
  "RESIDUAL_RETURN_COMPLETED",
  "REPAYMENT_SUBMITTED",
  "REPAYMENT_RECEIVED",
  "REPAYMENT_REJECTED",
]);

const NOTE_INVESTOR_COMMITTED_EVENTS = new Set<string>([
  "NOTE_CAMPAIGN_PAUSED",
  "NOTE_CAMPAIGN_RESUMED",
  "NOTE_FUNDING_CLOSED",
  "NOTE_FUNDING_FAILED",
  "NOTE_ACTIVATED",
  "NOTE_MARKED_DEFAULT",
]);

const PAYMENT_INVESTOR_SHOW = new Set<string>([
  "PAYMENT_FAILED",
  "PAYMENT_EXPIRED",
  "PAYMENT_NAME_CHECK_REJECTED",
  "INVESTOR_DEPOSIT_RECEIVED",
  "INVESTOR_WITHDRAWAL_REQUESTED",
  "INVESTOR_WITHDRAWAL_SUBMITTED_TO_TRUSTEE",
  "INVESTOR_WITHDRAWAL_COMPLETED",
]);

const PAYMENT_INVESTOR_CONDITIONAL = new Set<string>([
  "PAYMENT_REFUND_INITIATED",
  "PAYMENT_REFUNDED",
]);

const ONBOARDING_USER_FACING = new Set<string>([
  "ONBOARDING_STARTED",
  "ONBOARDING_RESTARTED",
  "ONBOARDING_APPROVED",
  "ONBOARDING_REJECTED",
  "ONBOARDING_COMPLETED",
]);

const ADMIN_ORGANIZATION_HIDDEN = new Set<string>(["USER_ONBOARDING_STATUS_UPDATED"]);

function metadataRecord(metadata?: Record<string, unknown> | null): Record<string, unknown> {
  return metadata && typeof metadata === "object" ? metadata : {};
}

function metadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function metadataBoolean(metadata: Record<string, unknown>, key: string): boolean | undefined {
  const value = metadata[key];
  return typeof value === "boolean" ? value : undefined;
}

export function isAmendmentRequiredStatus(status: string | undefined): boolean {
  if (!status) return false;
  return AMENDMENT_REQUIRED_STATUSES.has(status);
}

export function isDirectorKycActivityVisible(status: string | undefined): boolean {
  if (!status) return false;
  return DIRECTOR_KYC_VISIBLE_STATUSES.has(status.toUpperCase());
}

export function isOnboardingStatusChangedUserFacing(
  metadata?: Record<string, unknown> | null
): boolean {
  const record = metadataRecord(metadata);
  const previous = metadataString(record, "previousStatus")?.toUpperCase();
  const next = metadataString(record, "newStatus")?.toUpperCase();
  if (!previous || !next) return false;

  const fromInitial = previous === "IN_PROGRESS" || previous === "PENDING";
  if (fromInitial && (next === "PENDING_SSM_REVIEW" || next === "PENDING_APPROVAL")) {
    return true;
  }
  if (previous === "PENDING_AMENDMENT" && next === "PENDING_SSM_REVIEW") return true;
  if (
    (previous === "PENDING_SSM_REVIEW" || previous === "PENDING_APPROVAL") &&
    next === "PENDING_AMENDMENT"
  ) {
    return true;
  }
  return false;
}

export function isSophisticatedStatusMaterial(metadata?: Record<string, unknown> | null): boolean {
  const record = metadataRecord(metadata);
  const previousValue = metadataBoolean(record, "previousValue");
  const newValue = metadataBoolean(record, "newValue");
  if (previousValue == null || newValue == null) return false;
  return previousValue !== newValue;
}

export function isOnboardingActivityVisible(
  audience: ActivityAudience,
  eventType: string,
  metadata?: Record<string, unknown> | null,
  context?: ActivityVisibilityContext
): boolean {
  if (audience === "admin") {
    return !ADMIN_ORGANIZATION_HIDDEN.has(eventType);
  }

  if (ONBOARDING_USER_FACING.has(eventType)) {
    return true;
  }

  if (eventType === "ONBOARDING_STATUS_CHANGED") {
    return isOnboardingStatusChangedUserFacing(metadata);
  }

  if (eventType === "ONBOARDING_FINAL_APPROVAL_COMPLETED") {
    return false;
  }

  if (eventType === "INVESTOR_SOPHISTICATED_STATUS_UPDATED") {
    return audience === "investor" && isSophisticatedStatusMaterial(metadata);
  }

  if (eventType === "DIRECTOR_ONBOARDING_INVITATION_SENT") {
    return (
      audience === "issuer" &&
      context?.organizationKind === "ISSUER" &&
      context?.organizationType === "COMPANY"
    );
  }

  if (eventType === "DIRECTOR_KYC_STATUS_UPDATED") {
    if (audience !== "issuer") return false;
    const status = metadataString(metadataRecord(metadata), "newKycStatus");
    return isDirectorKycActivityVisible(status);
  }

  return false;
}

export function isApplicationActivityVisible(
  audience: ActivityAudience,
  eventType: string,
  metadata?: Record<string, unknown> | null
): boolean {
  if (audience === "investor") return false;

  if (eventType === "APPLICATION_SECTION_REVIEW_UPDATED") {
    return isAmendmentRequiredStatus(metadataString(metadataRecord(metadata), "newStatus"));
  }

  if (audience === "admin") {
    return APPLICATION_ADMIN_SHOW.has(eventType);
  }

  return APPLICATION_ISSUER_SHOW.has(eventType);
}

export function isSigningActivityVisible(
  audience: ActivityAudience,
  eventType: string
): boolean {
  if (audience === "investor") return false;
  if (audience === "admin") return SIGNING_ADMIN_SHOW.has(eventType);
  if (eventType === "SIGNING_EKYC_FAILED") return true;
  return SIGNING_ISSUER_SHOW.has(eventType);
}

export function isNoteActivityVisible(
  audience: ActivityAudience,
  eventType: string,
  metadata?: Record<string, unknown> | null,
  context?: ActivityVisibilityContext
): boolean {
  if (audience === "admin") return true;

  if (audience === "issuer") {
    if (eventType === "NOTE_TERMS_UPDATED") {
      return context?.noteVisibleToIssuer === true;
    }
    return NOTE_ISSUER_SHOW.has(eventType);
  }

  if (eventType === "INVESTMENT_COMMITTED") {
    const investorOrganizationId = metadataString(
      metadataRecord(metadata),
      "investorOrganizationId"
    );
    return (
      context?.organizationId != null &&
      investorOrganizationId === context.organizationId
    );
  }

  if (NOTE_INVESTOR_COMMITTED_EVENTS.has(eventType)) {
    return context?.investorCommitted === true;
  }

  if (eventType === "NOTE_SERVICING_STATUS_CHANGED") {
    if (context?.investorCommitted !== true) return false;
    const status = metadataString(metadataRecord(metadata), "newServicingStatus");
    return status != null && INVESTOR_MATERIAL_SERVICING_STATUSES.has(status);
  }

  if (eventType === "SETTLEMENT_POSTED") {
    return context?.settlementHasInvestorAllocation === true;
  }

  return false;
}

export function isIssuerNoteTermsVisible(note?: {
  publishedAt?: Date | string | null;
  listingStatus?: string | null;
} | null): boolean {
  if (!note) return false;
  if (note.publishedAt) return true;
  return note.listingStatus === "PUBLISHED" || note.listingStatus === "UNPUBLISHED";
}

export function settlementHasInvestorAllocation(
  snapshot: unknown,
  investorOrganizationId?: string | null
): boolean {
  if (!investorOrganizationId) return false;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;
  const allocations = (snapshot as { allocations?: unknown }).allocations;
  if (!Array.isArray(allocations)) return false;
  return allocations.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    return (entry as { investorOrganizationId?: unknown }).investorOrganizationId === investorOrganizationId;
  });
}

export function isPaymentActivityVisible(
  audience: ActivityAudience,
  eventType: string,
  context?: ActivityVisibilityContext
): boolean {
  if (audience !== "investor") return false;
  if (!PAYMENT_INVESTOR_SHOW.has(eventType) && !PAYMENT_INVESTOR_CONDITIONAL.has(eventType)) {
    return false;
  }
  if (!context?.organizationId || !context.ownerOrganizationId) return false;
  return context.organizationId === context.ownerOrganizationId;
}

export function isAdminApplicationTimelineVisible(
  eventType: string,
  metadata?: Record<string, unknown> | null
): boolean {
  if (eventType.startsWith("SIGNING_")) {
    return isSigningActivityVisible("admin", eventType);
  }
  return isApplicationActivityVisible("admin", eventType, metadata);
}

export function getOnboardingActivityEventTypes(audience: ActivityAudience): string[] {
  if (audience === "investor") {
    return [
      ...ONBOARDING_USER_FACING,
      "ONBOARDING_STATUS_CHANGED",
      "INVESTOR_SOPHISTICATED_STATUS_UPDATED",
    ];
  }
  if (audience === "issuer") {
    return [
      ...ONBOARDING_USER_FACING,
      "ONBOARDING_STATUS_CHANGED",
      "DIRECTOR_ONBOARDING_INVITATION_SENT",
      "DIRECTOR_KYC_STATUS_UPDATED",
    ];
  }
  return [];
}

export function getApplicationActivityEventTypes(audience: ActivityAudience): string[] {
  if (audience === "investor") return [];
  if (audience === "admin") {
    return [...APPLICATION_ADMIN_SHOW, "APPLICATION_SECTION_REVIEW_UPDATED"];
  }
  return [...APPLICATION_ISSUER_SHOW, "APPLICATION_SECTION_REVIEW_UPDATED"];
}

export function getSigningActivityEventTypes(audience: ActivityAudience): string[] {
  if (audience === "investor") return [];
  if (audience === "admin") return [...SIGNING_ADMIN_SHOW];
  return [...SIGNING_ISSUER_SHOW, "SIGNING_EKYC_FAILED"];
}

export function getNoteActivityEventTypes(audience: ActivityAudience): string[] {
  if (audience === "issuer") {
    return [...NOTE_ISSUER_SHOW, "NOTE_TERMS_UPDATED"];
  }
  if (audience === "investor") {
    return [
      "INVESTMENT_COMMITTED",
      ...NOTE_INVESTOR_COMMITTED_EVENTS,
      "NOTE_SERVICING_STATUS_CHANGED",
      "SETTLEMENT_POSTED",
    ];
  }
  return [];
}

export function getPaymentActivityEventTypes(audience: ActivityAudience): string[] {
  if (audience !== "investor") return [];
  return [...PAYMENT_INVESTOR_SHOW, ...PAYMENT_INVESTOR_CONDITIONAL];
}
