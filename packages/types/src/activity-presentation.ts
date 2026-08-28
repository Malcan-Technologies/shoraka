import {
  getFilterableActivityDomains,
  type ActivityDomain,
  type ActivityPortal,
} from "./activity-config";


/** Viewer-centric tokens for issuer/investor activity rows. Same six as StatusBadge. */
export type ActivityStatusToken =
  | "action"
  | "submitted"
  | "success"
  | "active"
  | "rejected"
  | "neutral";

export const ACTIVITY_STATUS_LABEL: Record<ActivityStatusToken, string> = {
  action: "Action needed",
  submitted: "Waiting",
  success: "Complete",
  active: "Live",
  rejected: "Failed",
  neutral: "Closed",
};

/**
 * Operations-facing labels for forensic audit `source` (channel of generation).
 *
 * Does not map NotificationLog.source, NotePayment.source, ledger sources, or similar fields.
 * Unknown values are returned unchanged so ADMIN/SYSTEM/PAYMASTER stay as stored.
 */
export function formatForensicAuditSourceLabel(source: string | null | undefined): string {
  if (!source?.trim()) return "";
  const key = source.trim().toUpperCase();
  if (key === "API" || key === "PORTAL") return "Portal";
  if (key === "WEBHOOK") return "Webhook";
  if (key === "SYSTEM_JOB" || key === "JOB") return "System job";
  if (key === "INTERNAL") return "Internal process";
  return source.trim();
}

/** Metadata-driven display for a single ROLE_SWITCHED event id. Raw id stays visible/exported. */
export function formatRoleSwitchedLabel(metadata?: Record<string, unknown> | null): string {
  const action = metadata?.action;
  if (action === "DEACTIVATED" || action === "DEACTIVATED_VIA_ROLE_REMOVAL") {
    return "Admin Deactivated";
  }
  if (action === "REACTIVATED" || action === "ACTIVATED_VIA_ROLE_ADDITION") {
    return "Admin Reactivated";
  }
  if (typeof metadata?.previousRole === "string" && typeof metadata?.newRole === "string") {
    return "Admin Role Changed";
  }
  return "Role Switched";
}

const ACTIVITY_STATUS_BY_EVENT: Record<string, ActivityStatusToken> = {
  ONBOARDING_STARTED: "action",
  ONBOARDING_CANCELLED: "neutral",
  ONBOARDING_REJECTED: "rejected",
  FINAL_APPROVAL_COMPLETED: "success",
  ONBOARDING_APPROVED: "success",

  APPLICATION_CREATED: "action",
  APPLICATION_SUBMITTED: "submitted",
  APPLICATION_RESUBMITTED: "submitted",
  AMENDMENTS_SUBMITTED: "action",
  APPLICATION_APPROVED: "success",
  APPLICATION_REJECTED: "rejected",
  APPLICATION_WITHDRAWN: "neutral",
  APPLICATION_COMPLETED: "success",

  CONTRACT_OFFER_SENT: "action",
  CONTRACT_OFFER_ACCEPTANCE_SUBMITTED: "submitted",
  CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED: "submitted",
  CONTRACT_OFFER_ACCEPTED: "success",
  CONTRACT_OFFER_REJECTED: "rejected",
  CONTRACT_OFFER_RETRACTED: "neutral",
  CONTRACT_OFFER_EXPIRED: "rejected",
  CONTRACT_SIGNING_DEADLINE_EXTENDED: "submitted",
  CONTRACT_OFFER_DECLINED: "neutral",
  CONTRACT_FACILITY_FEE_WAIVED: "neutral",
  CONTRACT_FACILITY_DISABLED: "neutral",
  CONTRACT_FACILITY_ENABLED: "active",

  INVOICE_OFFER_SENT: "action",
  INVOICE_OFFER_ACCEPTANCE_SUBMITTED: "submitted",
  INVOICE_OFFER_ACCEPTANCE_RESUBMITTED: "submitted",
  INVOICE_OFFER_ACCEPTED: "success",
  INVOICE_OFFER_REJECTED: "rejected",
  INVOICE_OFFER_RETRACTED: "neutral",
  INVOICE_OFFER_EXPIRED: "rejected",
  INVOICE_SIGNING_DEADLINE_EXTENDED: "submitted",
  INVOICE_WITHDRAWN: "neutral",

  SIGNING_PACKAGE_SENT: "action",

  NOTE_CREATED_FROM_INVOICE: "action",
  PUBLISH: "submitted",
  PAUSE_LISTING: "neutral",
  RESUME_LISTING: "submitted",
  CLOSE_FUNDING: "submitted",
  NOTE_FACILITY_FEE_COLLECTION_WAIVED: "neutral",
  FAIL_FUNDING: "rejected",
  ACTIVATE: "active",
  WITHDRAWAL_COMPLETED: "active",
  ISSUER_PAYMENT_SUBMITTED: "submitted",
  INVESTMENT_COMMITTED: "success",
  SETTLEMENT_POSTED: "success",
  NOTE_DEFAULT_MARKED: "rejected",
};

export function getActivityStatusToken(eventType: string): ActivityStatusToken {
  return ACTIVITY_STATUS_BY_EVENT[eventType] ?? "neutral";
}

export function getActivityStatusLabel(eventType: string): string {
  return ACTIVITY_STATUS_LABEL[getActivityStatusToken(eventType)];
}

export function getDefaultActivityDomains(
  portal: ActivityPortal,
  options?: { onboardingComplete?: boolean }
): ActivityDomain[] {
  if (options?.onboardingComplete !== true) {
    return [];
  }
  return getFilterableActivityDomains(portal).filter((domain) => domain !== "onboarding");
}

export function sameActivityDomainSet(a: ActivityDomain[], b: ActivityDomain[]): boolean {
  if (a.length !== b.length) return false;
  const right = new Set(b);
  return a.every((domain) => right.has(domain));
}

export function getActivityHref(
  activity: {
    domain: ActivityDomain;
    event_type: string;
    references?: {
      applicationId?: string;
      contractId?: string;
      invoiceId?: string;
      noteId?: string;
    } | null;
  },
  portal: ActivityPortal
): string | null {
  const refs = activity.references ?? {};

  if (portal === "issuer") {
    if (refs.invoiceId) return `/financing/invoices/${refs.invoiceId}`;
    if (refs.contractId) return `/financing/contracts/${refs.contractId}`;
    if (refs.applicationId) return `/applications/${refs.applicationId}`;
    if (refs.noteId) return `/financing/notes/${refs.noteId}`;
    if (activity.domain === "onboarding") return "/profile";
    return null;
  }

  if (refs.noteId) return `/investments/${refs.noteId}`;
  if (activity.domain === "onboarding") return "/profile";
  return null;
}
