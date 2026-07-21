import {
  getProspectusDisplayStatus,
  type ProspectusReviewStatus,
} from "@cashsouk/types";

/** Four top-level working-area pages. */
export type ProspectusWorkflowStepId = 0 | 1 | 2 | 3;

export const PROSPECTUS_STEP_GROUPS: Array<{
  group: string;
  steps: Array<{ id: ProspectusWorkflowStepId; label: string }>;
}> = [
  {
    group: "Working area",
    steps: [
      { id: 0, label: "Investment Overview" },
      { id: 1, label: "Issuer & Credit Review" },
      { id: 2, label: "Financial Review" },
      { id: 3, label: "Preview & Approval" },
    ],
  },
];

export const PROSPECTUS_STEP_TITLES: Record<ProspectusWorkflowStepId, string> = {
  0: "Investment Overview",
  1: "Issuer & Credit Review",
  2: "Financial Review",
  3: "Preview & Approval",
};

export const PROSPECTUS_STEP_PAGE_LABEL: Record<ProspectusWorkflowStepId, string> = {
  0: "Page 1",
  1: "Page 2",
  2: "Page 3",
  3: "Final",
};

export function formatProspectusReviewStatus(
  status: ProspectusReviewStatus,
  notePublished = false
): string {
  return getProspectusDisplayStatus({ reviewStatus: status, notePublished });
}

export const HIGHLIGHT_FIELD_LABELS: Record<string, string> = {
  paymaster: "Paymaster Highlight",
  issuer_fundamentals: "Issuer Financial Strength",
  return: "Return Highlight",
  shariah: "Shariah Compliance Highlight",
};

export const INVOICE_WORK_FIELD_LABELS: Record<string, string> = {
  work_under_contract: "Work Performed Under Contract",
  certification_acceptance: "Work Certification and Acceptance",
  paymaster_trust_account: "Payment to CashSouk Trust Account",
  deed_of_assignment: "Deed of Assignment",
};

export function formatActorDisplayName(user: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
} | null | undefined): string {
  if (!user) return "System";
  const fullName = [user.first_name, user.last_name]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;
  if (user.email?.trim()) return user.email.trim();
  return "System";
}

export function looksLikeRawKey(value: string): boolean {
  return /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(value.trim());
}
