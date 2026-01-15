export interface EventConfig {
  label: string;
  dotColor: string;
}

/**
 * Centralized configuration for all activity events.
 * Maps raw event types to human-readable labels and UI colors.
 */
export const ACTIVITY_EVENT_CONFIG: Record<string, EventConfig> = {
  // Onboarding Logs
  ONBOARDING_STARTED: { label: "Onboarding Started", dotColor: "bg-emerald-500" },
  ONBOARDING_RESUMED: { label: "Onboarding Resumed", dotColor: "bg-cyan-500" },
  ONBOARDING_CANCELLED: { label: "Onboarding Cancelled", dotColor: "bg-gray-500" },
  ONBOARDING_REJECTED: { label: "Onboarding Rejected", dotColor: "bg-red-500" },
  ONBOARDING_STATUS_UPDATED: { label: "Status Updated", dotColor: "bg-indigo-500" },
  FORM_FILLED: { label: "Form Filled", dotColor: "bg-sky-500" },
  ONBOARDING_APPROVED: { label: "Onboarding Approved", dotColor: "bg-green-500" },
  AML_APPROVED: { label: "AML Approved", dotColor: "bg-lime-500" },
  TNC_APPROVED: { label: "T&C Approved", dotColor: "bg-emerald-500" },
  TNC_ACCEPTED: { label: "T&C Accepted", dotColor: "bg-emerald-500" },
  SSM_APPROVED: { label: "SSM Approved", dotColor: "bg-teal-500" },
  FINAL_APPROVAL_COMPLETED: { label: "Final Approval", dotColor: "bg-green-500" },
  SOPHISTICATED_STATUS_UPDATED: { label: "Sophisticated Updated", dotColor: "bg-violet-500" },

  // Access Logs
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
