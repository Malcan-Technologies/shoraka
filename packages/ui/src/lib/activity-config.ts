export interface EventConfig {
  label: string;
  dotColor: string;
}

/**
 * Centralized configuration for all activity events.
 * Maps raw event types to human-readable labels and UI colors.
 */
export const ACTIVITY_EVENT_CONFIG: Record<string, EventConfig> = {
  // Security Logs (Matches apps/admin/src/app/audit/security-logs/page.tsx)
  PASSWORD_CHANGED: { label: "Password Changed", dotColor: "bg-rose-500" },
  EMAIL_CHANGED: { label: "Email Changed", dotColor: "bg-cyan-500" },
  ROLE_ADDED: { label: "Role Added", dotColor: "bg-purple-500" },
  ROLE_SWITCHED: { label: "Role Switched", dotColor: "bg-orange-500" },
  PROFILE_UPDATED: { label: "Profile Updated", dotColor: "bg-blue-500" },
  // Additional Security
  EMAIL_VERIFIED: { label: "Email Verified", dotColor: "bg-green-400" },
  SECURITY_ALERT: { label: "Security Alert", dotColor: "bg-red-600" },
  LOGIN_FAILURE: { label: "Login Failed", dotColor: "bg-red-500" },
  NEW_DEVICE_LOGIN: { label: "New Device", dotColor: "bg-orange-400" },

  // Onboarding Logs (Matches apps/admin/src/app/audit/onboarding-logs/page.tsx)
  ONBOARDING_STARTED: { label: "Onboarding Started", dotColor: "bg-emerald-500" },
  ONBOARDING_RESUMED: { label: "Onboarding Resumed", dotColor: "bg-cyan-500" },
  ONBOARDING_STATUS_UPDATED: { label: "Status Updated", dotColor: "bg-indigo-500" },
  ONBOARDING_CANCELLED: { label: "Onboarding Cancelled", dotColor: "bg-gray-500" },
  ONBOARDING_REJECTED: { label: "Onboarding Rejected", dotColor: "bg-red-500" },
  SOPHISTICATED_STATUS_UPDATED: { label: "Sophisticated Updated", dotColor: "bg-violet-500" },
  FINAL_APPROVAL_COMPLETED: { label: "Final Approval", dotColor: "bg-green-500" },
  FORM_FILLED: { label: "Form Filled", dotColor: "bg-sky-500" },
  ONBOARDING_APPROVED: { label: "Onboarding Approved", dotColor: "bg-green-500" },
  AML_APPROVED: { label: "AML Approved", dotColor: "bg-lime-500" },
  TNC_APPROVED: { label: "T&C Approved", dotColor: "bg-emerald-500" },
  SSM_APPROVED: { label: "SSM Approved", dotColor: "bg-teal-500" },
  TNC_ACCEPTED: { label: "T&C Accepted", dotColor: "bg-emerald-500" },
  // Additional Onboarding
  KYC_SUBMITTED: { label: "KYC Submitted", dotColor: "bg-yellow-500" },
  USER_COMPLETED: { label: "User Completed", dotColor: "bg-teal-500" },

  // Document Logs (Matches apps/admin/src/app/audit/document-logs/page.tsx)
  DOCUMENT_CREATED: { label: "Document Uploaded", dotColor: "bg-violet-500" },
  DOCUMENT_UPDATED: { label: "Document Updated", dotColor: "bg-blue-400" },
  DOCUMENT_REPLACED: { label: "Document Replaced", dotColor: "bg-yellow-500" },
  DOCUMENT_DELETED: { label: "Document Deleted", dotColor: "bg-gray-500" },
  DOCUMENT_RESTORED: { label: "Document Restored", dotColor: "bg-purple-500" },

  // Authentication (General Access Logs)
  LOGIN: { label: "Login", dotColor: "bg-blue-500" },
  LOGOUT: { label: "Logout", dotColor: "bg-gray-500" },
  SIGNUP: { label: "Sign Up", dotColor: "bg-green-500" },
  KYC_STATUS_UPDATED: { label: "KYC Updated", dotColor: "bg-yellow-500" },
};

/**
 * Fallback for unknown event types
 */
export function getEventConfig(eventType: string): EventConfig {
  return (
    ACTIVITY_EVENT_CONFIG[eventType] || {
      label: eventType
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      dotColor: "bg-gray-400",
    }
  );
}
