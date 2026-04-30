import { PortalType } from "../../lib/http/url-utils";
import { PortalContext } from "../../lib/http/portal-context";

/**
 * Registry of all system notification types to ensure type safety
 * when sending notifications from various services.
 */
export const NotificationTypeIds = {
  // System / Onboarding
  ONBOARDING_APPROVED: 'onboarding_approved',
  ONBOARDING_REJECTED: 'onboarding_rejected',
  KYC_APPROVED: 'kyc_approved',
  KYC_REJECTED: 'kyc_rejected',

  // Authentication
  PASSWORD_CHANGED: 'password_changed',
  LOGIN_NEW_DEVICE: 'login_new_device',

  // Marketing / Generic
  SYSTEM_ANNOUNCEMENT: 'system_announcement',
  NEW_PRODUCT_ALERT: 'new_product_alert',

  // Issuer application / review lifecycle
  APPLICATION_AMENDMENTS_REQUESTED: 'application_amendments_requested',
  APPLICATION_APPROVED: 'application_approved',
  APPLICATION_REJECTED: 'application_rejected',
  CONTRACT_OFFER_SENT: 'contract_offer_sent',
  INVOICE_OFFER_SENT: 'invoice_offer_sent',
  OFFER_RETRACTED_OR_RESET: 'offer_retracted_or_reset',
  OFFER_EXPIRED: 'offer_expired',
  OFFER_EXPIRY_REMINDER_24H: 'offer_expiry_reminder_24h',
  APPLICATION_RESUBMITTED_CONFIRMATION: 'application_resubmitted_confirmation',
  APPLICATION_WITHDRAWN_CONFIRMATION: 'application_withdrawn_confirmation',
  APPLICATION_COMPLETED: 'application_completed',

  /** Issuer: CTOS/AML snapshot shows director/shareholder verification needed (event only). */
  DIRECTOR_SHAREHOLDER_MISMATCH: 'director_shareholder_mismatch',
  /** Issuer: admin asked party to correct and resubmit (event only). */
  DIRECTOR_SHAREHOLDER_REJECTED: 'director_shareholder_rejected',
  /** Issuer: admin requests onboarding action for one eligible party. */
  DIRECTOR_SHAREHOLDER_ACTION_REQUIRED: 'director_shareholder_action_required',

  // Note lifecycle
  NOTE_PUBLISHED: 'note_published',
  NOTE_FUNDING_SUCCEEDED: 'note_funding_succeeded',
  NOTE_FUNDING_FAILED: 'note_funding_failed',
  NOTE_PAYMENT_RECEIVED: 'note_payment_received',
  NOTE_SETTLEMENT_POSTED: 'note_settlement_posted',
  NOTE_ARREARS: 'note_arrears',
  NOTE_DEFAULTED: 'note_defaulted',
  WITHDRAWAL_SUBMITTED_TO_TRUSTEE: 'withdrawal_submitted_to_trustee',
} as const;

export type NotificationTypeId = typeof NotificationTypeIds[keyof typeof NotificationTypeIds];

/**
 * Define the payload data required for each notification type
 */
export interface NotificationPayloads {
  [NotificationTypeIds.ONBOARDING_APPROVED]: {
    onboardingType: string;
    orgName: string;
    portalType: 'investor' | 'issuer';
  };
  [NotificationTypeIds.ONBOARDING_REJECTED]: {
    onboardingType: string;
    orgName: string;
    reason?: string;
  };
  [NotificationTypeIds.KYC_APPROVED]: {
    userName: string;
  };
  [NotificationTypeIds.KYC_REJECTED]: {
    userName: string;
    reason?: string;
  };
  [NotificationTypeIds.PASSWORD_CHANGED]: {
    changedAt: Date;
  };
  [NotificationTypeIds.LOGIN_NEW_DEVICE]: {
    deviceName: string;
    location: string;
    time: Date;
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
    amendmentCount: number;
  };
  [NotificationTypeIds.APPLICATION_APPROVED]: {
    applicationId: string;
  };
  [NotificationTypeIds.APPLICATION_REJECTED]: {
    applicationId: string;
  };
  [NotificationTypeIds.CONTRACT_OFFER_SENT]: {
    applicationId: string;
    offeredFacility: number;
    expiresAt?: string | null;
  };
  [NotificationTypeIds.INVOICE_OFFER_SENT]: {
    applicationId: string;
    invoiceId: string;
    invoiceNumber?: string | null;
    offeredAmount: number;
    expiresAt?: string | null;
  };
  [NotificationTypeIds.OFFER_RETRACTED_OR_RESET]: {
    applicationId: string;
    offerType: 'contract' | 'invoice';
    invoiceNumber?: string | null;
  };
  [NotificationTypeIds.OFFER_EXPIRED]: {
    applicationId: string;
    offerType: 'contract' | 'invoice';
    invoiceNumber?: string | null;
  };
  [NotificationTypeIds.OFFER_EXPIRY_REMINDER_24H]: {
    applicationId: string;
    offerType: 'contract' | 'invoice';
    invoiceNumber?: string | null;
    expiresAt: string;
  };
  [NotificationTypeIds.APPLICATION_RESUBMITTED_CONFIRMATION]: {
    applicationId: string;
    reviewCycle: number;
  };
  [NotificationTypeIds.APPLICATION_WITHDRAWN_CONFIRMATION]: {
    applicationId: string;
  };
  [NotificationTypeIds.APPLICATION_COMPLETED]: {
    applicationId: string;
  };
  [NotificationTypeIds.DIRECTOR_SHAREHOLDER_MISMATCH]: {
    issuerOrganizationId: string;
  };
  [NotificationTypeIds.DIRECTOR_SHAREHOLDER_REJECTED]: {
    issuerOrganizationId: string;
    partyKey: string;
    personName?: string;
  };
  [NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED]: {
    issuerOrganizationId: string;
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
  [NotificationTypeIds.NOTE_FUNDING_FAILED]: {
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
  [NotificationTypeIds.NOTE_DEFAULTED]: {
    noteId: string;
    noteTitle: string;
  };
  [NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE]: {
    withdrawalId: string;
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

function getShortApplicationRef(applicationId: string): string {
  return `#${applicationId.slice(-8).toUpperCase()}`;
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
    title: 'Onboarding Application Approved',
    message: (data) =>
      `Congratulations! Your ${data.onboardingType.toLowerCase()} onboarding for ${data.orgName} has been completed successfully. You now have full access to the platform.`,
    linkPath: () => '/',
    portal: (data) => data.portalType,
  },
  [NotificationTypeIds.ONBOARDING_REJECTED]: {
    title: 'Onboarding Application Rejected',
    message: (data) =>
      `Unfortunately, your ${data.onboardingType.toLowerCase()} onboarding for ${data.orgName} was rejected.${data.reason ? ` Reason: ${data.reason}` : ''}`,
    linkPath: () => '/onboarding',
  },
  [NotificationTypeIds.KYC_APPROVED]: {
    title: 'Identity Verification Approved',
    message: (data) => `Hello ${data.userName}, your identity verification has been approved.`,
    linkPath: () => '/account',
  },
  [NotificationTypeIds.KYC_REJECTED]: {
    title: 'Identity Verification Rejected',
    message: (data) => `Hello ${data.userName}, your identity verification was rejected.${data.reason ? ` Reason: ${data.reason}` : ''}`,
    linkPath: () => '/account',
  },
  [NotificationTypeIds.PASSWORD_CHANGED]: {
    title: 'Password Changed',
    message: (data) => `The password for your account was changed on ${formatDateDDMMYYYY(data.changedAt)}.`,
    linkPath: () => '/account',
  },
  [NotificationTypeIds.LOGIN_NEW_DEVICE]: {
    title: 'Login from New Device',
    message: (data) => `A new login was detected on ${data.deviceName} from ${data.location} at ${formatDateDDMMYYYY(data.time)}.`,
    linkPath: () => '/account',
  },
  [NotificationTypeIds.SYSTEM_ANNOUNCEMENT]: {
    title: (data) => data.title,
    message: (data) => data.message,
    linkPath: () => '/',
  },
  [NotificationTypeIds.NEW_PRODUCT_ALERT]: {
    title: 'New Investment Opportunity',
    message: (data) => `A new product "${data.productName}" is now available for investment.`,
    linkPath: (data) => `/investments/${data.productId}`,
  },
  [NotificationTypeIds.APPLICATION_AMENDMENTS_REQUESTED]: {
    title: 'Amendment Requested',
    message: (data) =>
      `Your application ${getShortApplicationRef(data.applicationId)} requires updates. ${data.amendmentCount} amendment item(s) were requested by the reviewer.`,
    linkPath: (data) => `/applications/edit/${data.applicationId}`,
    portal: 'issuer',
  },
  [NotificationTypeIds.APPLICATION_APPROVED]: {
    title: 'Application Approved',
    message: (data) => `Your application ${getShortApplicationRef(data.applicationId)} has been approved.`,
    linkPath: () => `/applications`,
    portal: 'issuer',
  },
  [NotificationTypeIds.APPLICATION_REJECTED]: {
    title: 'Application Rejected',
    message: (data) => `Your application ${getShortApplicationRef(data.applicationId)} has been rejected.`,
    linkPath: () => `/applications`,
    portal: 'issuer',
  },
  [NotificationTypeIds.CONTRACT_OFFER_SENT]: {
    title: 'Contract Offer Received',
    message: (data) =>
      `A contract offer of ${data.offeredFacility.toLocaleString()} has been sent to your application ${getShortApplicationRef(data.applicationId)}.${data.expiresAt ? ` It expires on ${formatDateDDMMYYYY(data.expiresAt)}.` : ''}`,
    linkPath: () => `/applications`,
    portal: 'issuer',
  },
  [NotificationTypeIds.INVOICE_OFFER_SENT]: {
    title: 'Invoice Offer Received',
    message: (data) =>
      `An invoice offer${data.invoiceNumber ? ` for invoice ${data.invoiceNumber}` : ''} of RM${data.offeredAmount.toLocaleString()} has been sent.${data.expiresAt ? ` It expires on ${formatDateDDMMYYYY(data.expiresAt)}.` : ''}`,
    linkPath: () => `/applications`,
    portal: 'issuer',
  },
  [NotificationTypeIds.OFFER_RETRACTED_OR_RESET]: {
    title: 'Offer Updated',
    message: (data) =>
      `${data.offerType === 'contract' ? 'Contract' : 'Invoice'} offer${data.invoiceNumber ? ` (${data.invoiceNumber})` : ''} was retracted or reset and is no longer active.`,
    linkPath: () => `/applications`,
    portal: 'issuer',
  },
  [NotificationTypeIds.OFFER_EXPIRED]: {
    title: 'Offer Expired',
    message: (data) =>
      `${data.offerType === 'contract' ? 'Contract' : 'Invoice'} offer${data.invoiceNumber ? ` (${data.invoiceNumber})` : ''} has expired.`,
    linkPath: () => `/applications`,
    portal: 'issuer',
  },
  [NotificationTypeIds.OFFER_EXPIRY_REMINDER_24H]: {
    title: 'Offer Expiring Soon',
    message: (data) =>
      `${data.offerType === 'contract' ? 'Contract' : 'Invoice'} offer${data.invoiceNumber ? ` (${data.invoiceNumber})` : ''} expires within 24 hours at ${formatDateDDMMYYYY(data.expiresAt)}.`,
    linkPath: () => `/applications`,
    portal: 'issuer',
  },
  [NotificationTypeIds.APPLICATION_RESUBMITTED_CONFIRMATION]: {
    title: 'Application Resubmitted',
    message: (data) =>
      `Your application ${getShortApplicationRef(data.applicationId)} was successfully resubmitted for review (review cycle ${data.reviewCycle}).`,
    linkPath: () => `/applications`,
    portal: 'issuer',
  },
  [NotificationTypeIds.APPLICATION_WITHDRAWN_CONFIRMATION]: {
    title: 'Application Withdrawn',
    message: (data) => `Your application ${getShortApplicationRef(data.applicationId)} has been withdrawn successfully.`,
    linkPath: (data) => `/applications/${data.applicationId}`,
    portal: 'issuer',
  },
  [NotificationTypeIds.APPLICATION_COMPLETED]: {
    title: 'Application Completed',
    message: (data) => `Your application ${getShortApplicationRef(data.applicationId)} has been completed successfully.`,
    linkPath: (data) => `/applications/${data.applicationId}`,
    portal: 'issuer',
  },
  [NotificationTypeIds.DIRECTOR_SHAREHOLDER_MISMATCH]: {
    title: 'Directors/Shareholders Update Required',
    message: () =>
      'We found differences in your directors/shareholders. Please review and complete verification.',
    linkPath: () => '/profile',
    portal: 'issuer',
  },
  [NotificationTypeIds.DIRECTOR_SHAREHOLDER_REJECTED]: {
    title: 'Action Required: Director/Shareholder Update',
    message: (data) => {
      const who = data.personName?.trim() ? ` (${data.personName.trim()})` : '';
      return `This individual${who} requires correction. Please review and resubmit their details.`;
    },
    linkPath: () => '/profile',
    portal: 'issuer',
  },
  [NotificationTypeIds.DIRECTOR_SHAREHOLDER_ACTION_REQUIRED]: {
    title: 'Action Required: Complete Director/Shareholder Onboarding',
    message: (data) => {
      const who = data.personName?.trim() ? ` for ${data.personName.trim()}` : "";
      return `Please complete onboarding${who}.`;
    },
    linkPath: (data) => data.link || '/profile',
    portal: 'issuer',
  },
  [NotificationTypeIds.NOTE_PUBLISHED]: {
    title: 'New Investment Note Available',
    message: (data) => `A new note "${data.noteTitle}" is available in the marketplace.`,
    linkPath: (data) => `/investments/${data.noteId}`,
    portal: 'investor',
  },
  [NotificationTypeIds.NOTE_FUNDING_SUCCEEDED]: {
    title: 'Note Funding Completed',
    message: (data) => `Funding for "${data.noteTitle}" has reached the required threshold.`,
    linkPath: (data) => `/investments/${data.noteId}`,
    portal: 'investor',
  },
  [NotificationTypeIds.NOTE_FUNDING_FAILED]: {
    title: 'Note Funding Did Not Complete',
    message: (data) => `Funding for "${data.noteTitle}" did not reach the required threshold.`,
    linkPath: (data) => `/investments/${data.noteId}`,
    portal: 'investor',
  },
  [NotificationTypeIds.NOTE_PAYMENT_RECEIVED]: {
    title: 'Repayment Received',
    message: (data) => `A repayment was recorded for "${data.noteTitle}".`,
    linkPath: (data) => `/investments/${data.noteId}`,
    portal: 'investor',
  },
  [NotificationTypeIds.NOTE_SETTLEMENT_POSTED]: {
    title: 'Settlement Posted',
    message: (data) => `Settlement has been posted for "${data.noteTitle}".`,
    linkPath: (data) => `/investments/${data.noteId}`,
    portal: 'investor',
  },
  [NotificationTypeIds.NOTE_ARREARS]: {
    title: 'Note in Arrears',
    message: (data) => `"${data.noteTitle}" has moved into arrears.`,
    linkPath: (data) => `/notes/${data.noteId}`,
    portal: 'issuer',
  },
  [NotificationTypeIds.NOTE_DEFAULTED]: {
    title: 'Note Marked as Default',
    message: (data) => `"${data.noteTitle}" has been marked as default.`,
    linkPath: (data) => `/notes/${data.noteId}`,
    portal: 'issuer',
  },
  [NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE]: {
    title: 'Withdrawal Submitted to Trustee',
    message: (data) => `Withdrawal instruction ${data.withdrawalId} has been submitted to the trustee.`,
    linkPath: () => `/account`,
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
  const templatePortal = typeof template.portal === 'function' ? template.portal(data) : template.portal;

  return {
    title: typeof template.title === 'function' ? template.title(data) : template.title,
    message: template.message(data),
    linkPath: template.linkPath(data),
    portal: templatePortal || PortalContext.get(),
  };
}
