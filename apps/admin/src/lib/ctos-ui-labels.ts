/**
 * SECTION: Shared CTOS action copy (admin)
 * WHY: One wording for fetch / view / confirm across Financial, Business, onboarding, and org pages.
 * INPUT: N/A (constants only)
 * OUTPUT: Strings for buttons, dialogs, and short tooltips
 * WHERE USED: application-financial-review-content, business-section, organization-issuer-ctos-reports-card, ssm-verification-panel
 */

export const CTOS_UI = {
  viewReport: "View report",
  fetchReport: "Fetch report",
  fetching: "Fetching…",
  viewShort: "View",
  fetchShort: "Fetch",
} as const;

export const CTOS_CONFIRM = {
  title: "Fetch CTOS report?",
  primaryAction: CTOS_UI.fetchReport,
  cancel: "Cancel",
  organizationDescription:
    "This runs a new CTOS enquiry for the organization and saves the result. After it succeeds, the new copy appears in history and any screen that uses this data can read it.",
  subjectLead:
    "This runs a new CTOS enquiry for the person or entity below and saves it to this application.",
} as const;
