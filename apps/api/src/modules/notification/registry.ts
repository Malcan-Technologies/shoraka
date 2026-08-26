import { PortalType } from "../../lib/http/url-utils";
import { PortalContext } from "../../lib/http/portal-context";
import { formatApplicationNotificationRef, formatPhaseDeadlineDateDDMMYYYY } from "@cashsouk/types";

/**
 * Registry of all system notification types to ensure type safety
 * when sending notifications from various services.
 */
export const NotificationTypeIds = {
  // System / Onboarding
  ONBOARDING_APPROVED: "onboarding_approved",
  ONBOARDING_REJECTED: "onboarding_rejected",

  // Authentication
  PASSWORD_CHANGED: "password_changed",

  // Marketing / Generic
  SYSTEM_ANNOUNCEMENT: "system_announcement",
  NEW_PRODUCT_ALERT: "new_product_alert",

  // Issuer application / review lifecycle
  APPLICATION_AMENDMENTS_REQUESTED: "application_amendments_requested",
  /** Post-offer acceptance docs: admin requested a specific document change. */
  ACCEPTANCE_DOCUMENT_CHANGES_REQUESTED: "acceptance_document_changes_requested",
  APPLICATION_REJECTED: "application_rejected",
  CONTRACT_OFFER_SENT: "contract_offer_sent",
  INVOICE_OFFER_SENT: "invoice_offer_sent",
  OFFER_RETRACTED_OR_RESET: "offer_retracted_or_reset",
  OFFER_EXPIRED: "offer_expired",
  OFFER_EXPIRY_REMINDER_24H: "offer_expiry_reminder_24h",
  APPLICATION_RESUBMITTED_CONFIRMATION: "application_resubmitted_confirmation",
  APPLICATION_WITHDRAWN_CONFIRMATION: "application_withdrawn_confirmation",
  APPLICATION_COMPLETED: "application_completed",
  APPLICATION_SUBMITTED_CONFIRMATION: "application_submitted_confirmation",
  CONTRACT_SIGNING_DEADLINE_EXTENDED: "contract_signing_deadline_extended",
  INVOICE_SIGNING_DEADLINE_EXTENDED: "invoice_signing_deadline_extended",
  FACILITY_DISABLED: "facility_disabled",

  /** Issuer: CTOS or admin requests onboarding action for a director/shareholder party. */
  DIRECTOR_SHAREHOLDER_ACTION_REQUIRED: "director_shareholder_action_required",
  /** Investor company: CTOS finds new directors/shareholders needing onboarding. */
  INVESTOR_DIRECTOR_SHAREHOLDER_ACTION_REQUIRED: "investor_director_shareholder_action_required",

  // Note lifecycle
  NOTE_PUBLISHED: "note_published",
  NOTE_FUNDING_SUCCEEDED: "note_funding_succeeded",
  NOTE_FUNDING_FAILED_ISSUER: "note_funding_failed_issuer",
  NOTE_FUNDING_FAILED_INVESTOR: "note_funding_failed_investor",
  NOTE_ACTIVE_ISSUER: "note_active_issuer",
  NOTE_ACTIVE_INVESTOR: "note_active_investor",
  NOTE_REPAID_ISSUER: "note_repaid_issuer",
  NOTE_PAYMENT_RECEIVED: "note_payment_received",
  NOTE_SETTLEMENT_POSTED: "note_settlement_posted",
  NOTE_ARREARS: "note_arrears",
  NOTE_ARREARS_INVESTOR: "note_arrears_investor",
  NOTE_DEFAULTED: "note_defaulted",
  NOTE_DEFAULTED_INVESTOR: "note_defaulted_investor",
  WITHDRAWAL_SUBMITTED_TO_TRUSTEE: "withdrawal_submitted_to_trustee",
  NOTE_PAYMENT_REJECTED: "note_payment_rejected",
  WITHDRAWAL_COMPLETED: "withdrawal_completed",

  FACILITY_FEE_PAYMENT_REQUESTED: "facility_fee_payment_requested",
  FACILITY_FEE_UPFRONT_PAID: "facility_fee_upfront_paid",
  EXCESS_LATE_CHARGES_DUE: "excess_late_charges_due",
  EXCESS_LATE_CHARGES_PAID: "excess_late_charges_paid",

  DEPOSIT_NAME_CHECK_REJECTED: "deposit_name_check_rejected",
  DEPOSIT_REFUND_INITIATED: "deposit_refund_initiated",
  DEPOSIT_REFUNDED: "deposit_refunded",
  DEPOSIT_SUCCESSFUL: "deposit_successful",
  INVESTMENT_COMMITTED: "investment_committed",
  INVESTOR_WITHDRAWAL_SUBMITTED: "investor_withdrawal_submitted",
  INVESTOR_WITHDRAWAL_COMPLETED: "investor_withdrawal_completed",
} as const;

export type NotificationTypeId = (typeof NotificationTypeIds)[keyof typeof NotificationTypeIds];

/**
 * Define the payload data required for each notification type
 */
export interface NotificationPayloads {
  [NotificationTypeIds.ONBOARDING_APPROVED]: {
    onboardingType: string;
    orgName: string;
    portalType: "investor" | "issuer";
  };
  [NotificationTypeIds.ONBOARDING_REJECTED]: {
    onboardingType: string;
    orgName: string;
    reason?: string;
    portalType: "investor" | "issuer";
  };
  [NotificationTypeIds.PASSWORD_CHANGED]: {
    changedAt: Date;
  };
  [NotificationTypeIds.SYSTEM_ANNOUNCEMENT]: {
    title: string;
    message: string;
  };
  [NotificationTypeIds.NEW_PRODUCT_ALERT]: {
    productName: string;
    productId: string;
  };
  [NotificationTypeIds.APPLICATION_AMENDMENTS_REQUESTED]: {
    applicationId: string;
    displayReference?: string | null;
    amendmentCount: number;
  };
  [NotificationTypeIds.ACCEPTANCE_DOCUMENT_CHANGES_REQUESTED]: {
    applicationId: string;
    displayReference?: string | null;
  };
  [NotificationTypeIds.APPLICATION_REJECTED]: {
    applicationId: string;
    displayReference?: string | null;
  };
  [NotificationTypeIds.CONTRACT_OFFER_SENT]: {
    applicationId: string;
    displayReference?: string | null;
    offeredFacility: number;
    expiresAt?: string | null;
  };
  [NotificationTypeIds.INVOICE_OFFER_SENT]: {
    applicationId: string;
    displayReference?: string | null;
    invoiceId: string;
    invoiceNumber?: string | null;
    offeredAmount: number;
    expiresAt?: string | null;
  };
  [NotificationTypeIds.OFFER_RETRACTED_OR_RESET]: {
    applicationId: string;
    offerType: "contract" | "invoice";
    invoiceNumber?: string | null;
  };
  [NotificationTypeIds.OFFER_EXPIRED]: {
    applicationId: string;
    offerType: "contract" | "invoice";
    invoiceNumber?: string | null;
    clock?: "acceptance" | "signing";
  };
  [NotificationTypeIds.OFFER_EXPIRY_REMINDER_24H]: {
    applicationId: string;
    offerType: "contract" | "invoice";
    invoiceNumber?: string | null;
    expiresAt: string;
    clock?: "acceptance" | "signing";
    daysBeforeExpiry?: number;
  };
  [NotificationTypeIds.APPLICATION_RESUBMITTED_CONFIRMATION]: {
    applicationId: string;
    displayReference?: string | null;
    reviewCycle: number;
  };
  [NotificationTypeIds.APPLICATION_WITHDRAWN_CONFIRMATION]: {
    applicationId: string;
    displayReference?: string | null;
    /** Distinguishes a true application withdrawal from an issuer declining a facility/invoice offer, which also transitions the application to WITHDRAWN. Undefined = true withdrawal (default copy). */
    withdrawalReason?: "contract_offer_declined" | "invoice_offer_declined";
    invoiceNumber?: string | null;
  };
  [NotificationTypeIds.APPLICATION_COMPLETED]: {
    applicationId: string;
    displayReference?: string | null;
  };
  [NotificationTypeIds.APPLICATION_SUBMITTED_CONFIRMATION]: {
    applicationId: string;
    displayReference?: string | null;
  };
  [NotificationTypeIds.CONTRACT_SIGNING_DEADLINE_EXTENDED]: {
    applicationId: string;
    displayReference?: string | null;
    deadline: string | null;
  };
  [NotificationTypeIds.INVOICE_SIGNING_DEADLINE_EXTENDED]: {
    applicationId: string;
    displayReference?: string | null;
    invoiceNumber?: string | null;
    deadline: string | null;
  };
  [NotificationTypeIds.FACILITY_DISABLED]: {
    applicationId: string;
    displayReference?: string | null;
  };
  [NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED]: {
    issuerOrganizationId: string;
    partyKey: string;
    personName?: string;
    link: string;
  };
  [NotificationTypeIds.INVESTOR_DIRECTOR_SHAREHOLDER_ACTION_REQUIRED]: {
    investorOrganizationId: string;
    partyKey: string;
    personName?: string;
    link: string;
  };
  [NotificationTypeIds.NOTE_PUBLISHED]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.NOTE_FUNDING_SUCCEEDED]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.NOTE_FUNDING_FAILED_ISSUER]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.NOTE_FUNDING_FAILED_INVESTOR]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.NOTE_ACTIVE_ISSUER]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.NOTE_ACTIVE_INVESTOR]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.NOTE_REPAID_ISSUER]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.NOTE_PAYMENT_RECEIVED]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.NOTE_SETTLEMENT_POSTED]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.NOTE_ARREARS]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.NOTE_ARREARS_INVESTOR]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.NOTE_DEFAULTED]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.NOTE_DEFAULTED_INVESTOR]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE]: {
    withdrawalId: string;
    noteId: string;
    noteTitle: string;
    noteReference?: string | null;
    displayReference?: string | null;
    withdrawalType: string;
    portalType: "investor" | "issuer";
  };
  [NotificationTypeIds.NOTE_PAYMENT_REJECTED]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.WITHDRAWAL_COMPLETED]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.FACILITY_FEE_PAYMENT_REQUESTED]: {
    applicationId: string;
    displayReference?: string | null;
    contractId: string;
    upfrontAmount: number;
  };
  [NotificationTypeIds.FACILITY_FEE_UPFRONT_PAID]: {
    contractId: string;
    upfrontAmount: number;
  };
  [NotificationTypeIds.EXCESS_LATE_CHARGES_DUE]: {
    noteId: string;
    noteReference: string;
    outstandingAmount: number;
  };
  [NotificationTypeIds.EXCESS_LATE_CHARGES_PAID]: {
    noteId: string;
    noteReference: string;
    paidAmount: number;
  };
  [NotificationTypeIds.DEPOSIT_NAME_CHECK_REJECTED]: {
    amount: number;
  };
  [NotificationTypeIds.DEPOSIT_REFUND_INITIATED]: {
    amount: number;
  };
  [NotificationTypeIds.DEPOSIT_REFUNDED]: {
    amount: number;
  };
  [NotificationTypeIds.DEPOSIT_SUCCESSFUL]: {
    amount: number;
  };
  [NotificationTypeIds.INVESTMENT_COMMITTED]: {
    amount: number;
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.INVESTOR_WITHDRAWAL_SUBMITTED]: {
    amount: number;
  };
  [NotificationTypeIds.INVESTOR_WITHDRAWAL_COMPLETED]: {
    amount: number;
  };
}

/**
 * Template structure for a notification
 */
export interface NotificationTemplate<T extends NotificationTypeId> {
  title: string | ((data: NotificationPayloads[T]) => string);
  message: (data: NotificationPayloads[T]) => string;
  linkPath: (data: NotificationPayloads[T]) => string;
  portal?: PortalType | ((data: NotificationPayloads[T]) => PortalType);
}

function getApplicationNotificationRef(data: {
  applicationId: string;
  displayReference?: string | null;
}): string {
  return formatApplicationNotificationRef({
    id: data.applicationId,
    displayReference: data.displayReference,
  });
}

function formatDateDDMMYYYY(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Central registry of notification templates
 */
export const NOTIFICATION_TEMPLATES: {
  [T in NotificationTypeId]: NotificationTemplate<T>;
} = {
  [NotificationTypeIds.ONBOARDING_APPROVED]: {
    title: "Onboarding Application Approved",
    message: (data) =>
      `Congratulations! Your ${data.onboardingType.toLowerCase()} onboarding for ${data.orgName} has been completed successfully. You now have full access to the platform.`,
    linkPath: () => "/",
    portal: (data) => data.portalType,
  },
  [NotificationTypeIds.ONBOARDING_REJECTED]: {
    title: "Onboarding Application Rejected",
    message: (data) =>
      `Unfortunately, your ${data.onboardingType.toLowerCase()} onboarding for ${data.orgName} was rejected.${data.reason ? ` Reason: ${data.reason}` : ""}`,
    linkPath: () => "/onboarding",
    portal: (data) => data.portalType,
  },
  [NotificationTypeIds.PASSWORD_CHANGED]: {
    title: "Password Changed",
    message: (data) =>
      `The password for your account was changed on ${formatDateDDMMYYYY(data.changedAt)}.`,
    linkPath: () => "/account",
  },
  [NotificationTypeIds.SYSTEM_ANNOUNCEMENT]: {
    title: (data) => data.title,
    message: (data) => data.message,
    linkPath: () => "/",
  },
  [NotificationTypeIds.NEW_PRODUCT_ALERT]: {
    title: "New Investment Opportunity",
    message: (data) => `A new product "${data.productName}" is now available for investment.`,
    linkPath: (data) => `/investments/${data.productId}`,
  },
  [NotificationTypeIds.APPLICATION_AMENDMENTS_REQUESTED]: {
    title: "Amendment Requested",
    message: (data) =>
      `An amendment is required for application ${getApplicationNotificationRef(data)}. Review the request and resubmit your application.`,
    linkPath: (data) => `/applications/${data.applicationId}/edit`,
    portal: "issuer",
  },
  [NotificationTypeIds.ACCEPTANCE_DOCUMENT_CHANGES_REQUESTED]: {
    title: "Acceptance Documents Need Updates",
    message: (data) =>
      `A reviewer requested updates to acceptance documents on application ${getApplicationNotificationRef(data)}. Open Review Offer to see which files to replace.`,
    linkPath: () => `/applications`,
    portal: "issuer",
  },
  [NotificationTypeIds.APPLICATION_REJECTED]: {
    title: "Application Rejected",
    message: (data) => `Your application ${getApplicationNotificationRef(data)} has been rejected.`,
    linkPath: () => `/applications`,
    portal: "issuer",
  },
  [NotificationTypeIds.CONTRACT_OFFER_SENT]: {
    title: "Facility Offer Received",
    message: (data) =>
      `A facility offer of ${data.offeredFacility.toLocaleString()} has been sent to your application ${getApplicationNotificationRef(data)}.${data.expiresAt ? ` It expires on ${formatPhaseDeadlineDateDDMMYYYY(data.expiresAt)}.` : ""}`,
    linkPath: () => `/applications`,
    portal: "issuer",
  },
  [NotificationTypeIds.INVOICE_OFFER_SENT]: {
    title: "Invoice Offer Received",
    message: (data) =>
      `An invoice offer${data.invoiceNumber ? ` for invoice ${data.invoiceNumber}` : ""} of RM${data.offeredAmount.toLocaleString()} has been sent.${data.expiresAt ? ` It expires on ${formatPhaseDeadlineDateDDMMYYYY(data.expiresAt)}.` : ""}`,
    linkPath: () => `/applications`,
    portal: "issuer",
  },
  [NotificationTypeIds.OFFER_RETRACTED_OR_RESET]: {
    title: "Offer Updated",
    message: (data) =>
      `${data.offerType === "contract" ? "Facility" : "Invoice"} offer${data.invoiceNumber ? ` (${data.invoiceNumber})` : ""} was retracted or reset and is no longer active.`,
    linkPath: () => `/applications`,
    portal: "issuer",
  },
  [NotificationTypeIds.OFFER_EXPIRED]: {
    title: "Offer Expired",
    message: (data) =>
      `${data.offerType === "contract" ? "Facility" : "Invoice"} offer${data.invoiceNumber ? ` (${data.invoiceNumber})` : ""} has expired.`,
    linkPath: () => `/applications`,
    portal: "issuer",
  },
  [NotificationTypeIds.OFFER_EXPIRY_REMINDER_24H]: {
    title: "Offer Expiring Soon",
    message: (data) => {
      const daysBefore = data.daysBeforeExpiry;
      const windowLabel =
        typeof daysBefore === "number" && Number.isFinite(daysBefore)
          ? daysBefore <= 0
            ? "today"
            : daysBefore === 1
              ? "in 1 day"
              : `in ${daysBefore} days`
          : "soon";
      return `${data.offerType === "contract" ? "Facility" : "Invoice"} offer${data.invoiceNumber ? ` (${data.invoiceNumber})` : ""} expires ${windowLabel} on ${formatPhaseDeadlineDateDDMMYYYY(data.expiresAt)}.`;
    },
    linkPath: () => `/applications`,
    portal: "issuer",
  },
  [NotificationTypeIds.APPLICATION_RESUBMITTED_CONFIRMATION]: {
    title: "Application Resubmitted",
    message: (data) =>
      `Your application ${getApplicationNotificationRef(data)} was successfully resubmitted for review (review cycle ${data.reviewCycle}).`,
    linkPath: () => `/applications`,
    portal: "issuer",
  },
  [NotificationTypeIds.APPLICATION_WITHDRAWN_CONFIRMATION]: {
    title: (data) => {
      if (data.withdrawalReason === "contract_offer_declined") return "Facility Offer Declined";
      if (data.withdrawalReason === "invoice_offer_declined") return "Invoice Offer Declined";
      return "Application Withdrawn";
    },
    message: (data) => {
      if (data.withdrawalReason === "contract_offer_declined") {
        return `The facility offer on your application ${getApplicationNotificationRef(data)} was declined and the application is now closed.`;
      }
      if (data.withdrawalReason === "invoice_offer_declined") {
        return data.invoiceNumber
          ? `The invoice offer for invoice ${data.invoiceNumber} was declined.`
          : `The invoice offer on your application ${getApplicationNotificationRef(data)} was declined.`;
      }
      return `Your application ${getApplicationNotificationRef(data)} has been withdrawn successfully.`;
    },
    linkPath: (data) => `/applications/${data.applicationId}`,
    portal: "issuer",
  },
  [NotificationTypeIds.APPLICATION_COMPLETED]: {
    title: "Application Completed",
    message: (data) =>
      `Your application ${getApplicationNotificationRef(data)} has been completed successfully.`,
    linkPath: (data) => `/applications/${data.applicationId}`,
    portal: "issuer",
  },
  [NotificationTypeIds.APPLICATION_SUBMITTED_CONFIRMATION]: {
    title: 'Application Submitted',
    message: (data) =>
      `Your application ${getApplicationNotificationRef(data)} has been submitted successfully and is now under review.`,
    linkPath: () => `/applications`,
    portal: 'issuer',
  },
  [NotificationTypeIds.CONTRACT_SIGNING_DEADLINE_EXTENDED]: {
    title: 'Signing Deadline Extended',
    message: (data) =>
      `The signing deadline for application ${getApplicationNotificationRef(data)} has been extended${data.deadline ? ` to ${formatPhaseDeadlineDateDDMMYYYY(data.deadline)}` : ""}.`,
    linkPath: () => `/applications`,
    portal: 'issuer',
  },
  [NotificationTypeIds.INVOICE_SIGNING_DEADLINE_EXTENDED]: {
    title: 'Signing Deadline Extended',
    message: (data) =>
      `The signing deadline for invoice ${data.invoiceNumber ?? getApplicationNotificationRef(data)} has been extended${data.deadline ? ` to ${formatPhaseDeadlineDateDDMMYYYY(data.deadline)}` : ""}.`,
    linkPath: () => `/applications`,
    portal: 'issuer',
  },
  [NotificationTypeIds.FACILITY_DISABLED]: {
    title: 'Facility Disabled',
    message: (data) =>
      `Your facility for application ${getApplicationNotificationRef(data)} has been disabled. New drawdowns are currently unavailable.`,
    linkPath: () => `/applications`,
    portal: 'issuer',
  },
  [NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED]: {
    title: "Action Required: Complete Director/Shareholder Onboarding",
    message: (data) => {
      const who = data.personName?.trim() ? ` for ${data.personName.trim()}` : "";
      return `Please complete onboarding${who}.`;
    },
    linkPath: (data) => data.link || "/profile",
    portal: "issuer",
  },
  [NotificationTypeIds.INVESTOR_DIRECTOR_SHAREHOLDER_ACTION_REQUIRED]: {
    title: "Action Required: Complete Director/Shareholder Onboarding",
    message: (data) => {
      const who = data.personName?.trim() ? ` for ${data.personName.trim()}` : "";
      return `Please complete onboarding${who}.`;
    },
    linkPath: (data) => data.link || "/profile",
    portal: "investor",
  },
  [NotificationTypeIds.NOTE_PUBLISHED]: {
    title: "Note published",
    message: (data) =>
      `Your note "${data.noteTitle}" has been published to the marketplace for investor funding.`,
    linkPath: (data) => `/notes/${data.noteId}`,
    portal: "issuer",
  },
  [NotificationTypeIds.NOTE_FUNDING_SUCCEEDED]: {
    title: "Funding closed successfully",
    message: (data) =>
      `Funding for "${data.noteTitle}" has closed — the minimum threshold was reached and commitments are locked in.`,
    linkPath: (data) => `/notes/${data.noteId}`,
    portal: "issuer",
  },
  [NotificationTypeIds.NOTE_FUNDING_FAILED_ISSUER]: {
    title: "Note funding did not complete",
    message: (data) =>
      `Funding for "${data.noteTitle}" did not reach the minimum threshold before the listing closed.`,
    linkPath: (data) => `/notes/${data.noteId}`,
    portal: "issuer",
  },
  [NotificationTypeIds.NOTE_FUNDING_FAILED_INVESTOR]: {
    title: "Commitment released",
    message: (data) =>
      `The listing for "${data.noteTitle}" did not complete funding. Your reserved commitment has been released back to your available balance.`,
    linkPath: (data) => `/investments/${data.noteId}`,
    portal: "investor",
  },
  [NotificationTypeIds.NOTE_ACTIVE_ISSUER]: {
    title: "Note is active",
    message: (data) =>
      `Your note "${data.noteTitle}" is now active. Disbursement and servicing proceeds under the agreed terms.`,
    linkPath: (data) => `/notes/${data.noteId}`,
    portal: "issuer",
  },
  [NotificationTypeIds.NOTE_ACTIVE_INVESTOR]: {
    title: "Investment is active",
    message: (data) =>
      `Funding for "${data.noteTitle}" is complete and the note is now active. Monitor repayments from your investments view.`,
    linkPath: (data) => `/investments/${data.noteId}`,
    portal: "investor",
  },
  [NotificationTypeIds.NOTE_REPAID_ISSUER]: {
    title: "Note repaid",
    message: (data) =>
      `"${data.noteTitle}" has been fully repaid and settled. Any residual handling will follow operational workflow if applicable.`,
    linkPath: (data) => `/notes/${data.noteId}`,
    portal: "issuer",
  },
  [NotificationTypeIds.NOTE_PAYMENT_RECEIVED]: {
    title: "Repayment Received",
    message: (data) => `A repayment was recorded for "${data.noteTitle}".`,
    linkPath: (data) => `/investments/${data.noteId}`,
    portal: "investor",
  },
  [NotificationTypeIds.NOTE_SETTLEMENT_POSTED]: {
    title: "Settlement Posted",
    message: (data) => `Settlement has been posted for "${data.noteTitle}".`,
    linkPath: (data) => `/investments/${data.noteId}`,
    portal: "investor",
  },
  [NotificationTypeIds.NOTE_ARREARS]: {
    title: "Note in arrears",
    message: (data) =>
      `"${data.noteTitle}" has moved into arrears. Review repayment status and obligations.`,
    linkPath: (data) => `/notes/${data.noteId}`,
    portal: "issuer",
  },
  [NotificationTypeIds.NOTE_ARREARS_INVESTOR]: {
    title: "Note in Arrears",
    message: (data) =>
      `"${data.noteTitle}" is in arrears. We will keep you informed as servicing actions progress.`,
    linkPath: (data) => `/investments/${data.noteId}`,
    portal: "investor",
  },
  [NotificationTypeIds.NOTE_DEFAULTED]: {
    title: "Your Note Is in Default",
    message: (data) => `"${data.noteTitle}" has been marked as default.`,
    linkPath: (data) => `/notes/${data.noteId}`,
    portal: "issuer",
  },
  [NotificationTypeIds.NOTE_DEFAULTED_INVESTOR]: {
    title: "Your Investment Is in Default",
    message: (data) =>
      `"${data.noteTitle}" has been marked as default. This may affect recovery timelines; check your investments view for updates.`,
    linkPath: (data) => `/investments/${data.noteId}`,
    portal: "investor",
  },
  [NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE]: {
    title: "Withdrawal Submitted to Trustee",
    message: (data) => {
      const ref = data.displayReference?.trim() || data.withdrawalId;
      return `Withdrawal instruction ${ref} for "${data.noteTitle}" (${data.withdrawalType}) has been submitted to the trustee.`;
    },
    linkPath: (data) =>
      data.portalType === "investor"
        ? `/investments/${data.noteId}`
        : `/financing/notes/${data.noteId}`,
    portal: (data) => data.portalType,
  },
  [NotificationTypeIds.NOTE_PAYMENT_REJECTED]: {
    title: 'Repayment Rejected',
    message: (data) =>
      `Your repayment for note ${data.noteTitle} was rejected. Please review the repayment details.`,
    linkPath: (data) => `/notes/${data.noteId}`,
    portal: 'issuer',
  },
  [NotificationTypeIds.WITHDRAWAL_COMPLETED]: {
    title: 'Your Disbursement Is Complete',
    message: (data) => `The disbursement for note ${data.noteTitle} has been completed.`,
    linkPath: (data) => `/notes/${data.noteId}`,
    portal: 'issuer',
  },
  [NotificationTypeIds.FACILITY_FEE_PAYMENT_REQUESTED]: {
    title: "Upfront facility fee payment required",
    message: (data) =>
      `An upfront facility fee of RM${data.upfrontAmount.toLocaleString()} is due on your financing contract. Pay it before starting invoice financing.`,
    linkPath: (data) => `/financing/contracts/${data.contractId}`,
    portal: "issuer",
  },
  [NotificationTypeIds.FACILITY_FEE_UPFRONT_PAID]: {
    title: "Upfront facility fee paid",
    message: (data) =>
      `The upfront facility fee of RM${data.upfrontAmount.toLocaleString()} has been received. You can now use this facility for invoice financing.`,
    linkPath: (data) => `/financing/contracts/${data.contractId}`,
    portal: "issuer",
  },
  [NotificationTypeIds.EXCESS_LATE_CHARGES_DUE]: {
    title: "Outstanding late charges to pay",
    message: (data) =>
      `RM${data.outstandingAmount.toLocaleString()} in late payment charges is due on note ${data.noteReference}.`,
    linkPath: (data) => `/financing/notes/${data.noteId}#late-charges`,
    portal: "issuer",
  },
  [NotificationTypeIds.EXCESS_LATE_CHARGES_PAID]: {
    title: "Late payment charges received",
    message: (data) =>
      `The outstanding late payment charges of RM${data.paidAmount.toLocaleString()} on note ${data.noteReference} have been received.`,
    linkPath: (data) => `/financing/notes/${data.noteId}`,
    portal: "issuer",
  },
  [NotificationTypeIds.DEPOSIT_NAME_CHECK_REJECTED]: {
    title: 'Deposit Verification Failed',
    message: () => `Your deposit could not be verified and will be returned.`,
    linkPath: () => `/transactions`,
    portal: 'investor',
  },
  [NotificationTypeIds.DEPOSIT_REFUND_INITIATED]: {
    title: 'Refund Started',
    message: (data) => `A refund for your deposit of RM${data.amount.toLocaleString()} has been initiated.`,
    linkPath: () => `/transactions`,
    portal: 'investor',
  },
  [NotificationTypeIds.DEPOSIT_REFUNDED]: {
    title: 'Refund Completed',
    message: (data) => `Your refund of RM${data.amount.toLocaleString()} has been completed.`,
    linkPath: () => `/transactions`,
    portal: 'investor',
  },
  [NotificationTypeIds.DEPOSIT_SUCCESSFUL]: {
    title: "Deposit Successful",
    message: (data) =>
      `Your deposit of RM${data.amount.toLocaleString()} has been successfully credited to your wallet.`,
    linkPath: () => `/transactions`,
    portal: "investor",
  },
  [NotificationTypeIds.INVESTMENT_COMMITTED]: {
    title: "Investment Committed",
    message: (data) =>
      `Your investment of RM${data.amount.toLocaleString()} in "${data.noteTitle}" has been successfully committed.`,
    linkPath: (data) => `/investments/${data.noteId}`,
    portal: "investor",
  },
  [NotificationTypeIds.INVESTOR_WITHDRAWAL_SUBMITTED]: {
    title: "Withdrawal Submitted",
    message: (data) =>
      `Your withdrawal request of RM${data.amount.toLocaleString()} has been submitted for processing.`,
    linkPath: () => `/transactions`,
    portal: "investor",
  },
  [NotificationTypeIds.INVESTOR_WITHDRAWAL_COMPLETED]: {
    title: "Withdrawal Completed",
    message: (data) => `Your withdrawal of RM${data.amount.toLocaleString()} has been completed.`,
    linkPath: () => `/transactions`,
    portal: "investor",
  },
};

/**
 * Helper to get notification content from the registry
 */
export function getNotificationContent<T extends NotificationTypeId>(
  typeId: T,
  data: NotificationPayloads[T]
) {
  const template = NOTIFICATION_TEMPLATES[typeId];

  // Resolve portal: 1. Template override, 2. Current context
  const templatePortal =
    typeof template.portal === "function" ? template.portal(data) : template.portal;

  return {
    title: typeof template.title === "function" ? template.title(data) : template.title,
    message: template.message(data),
    linkPath: template.linkPath(data),
    portal: templatePortal || PortalContext.get(),
  };
}
