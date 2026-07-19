import type { ProspectusReviewStatus } from "@cashsouk/types";

export type ProspectusWorkflowStepId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const PROSPECTUS_STEP_GROUPS: Array<{
  group: string;
  steps: Array<{ id: ProspectusWorkflowStepId; label: string }>;
}> = [
  {
    group: "Page 1",
    steps: [
      { id: 0, label: "Core Terms" },
      { id: 1, label: "Investor Highlights" },
    ],
  },
  {
    group: "Page 2",
    steps: [
      { id: 2, label: "Issuer & Paymaster" },
      { id: 3, label: "Credit & Invoice Details" },
    ],
  },
  {
    group: "Page 3",
    steps: [
      { id: 4, label: "Financial Review" },
      { id: 5, label: "Investor Takeaways" },
    ],
  },
  {
    group: "Final",
    steps: [{ id: 6, label: "Preview & Approval" }],
  },
];

export const PROSPECTUS_STEP_TITLES: Record<ProspectusWorkflowStepId, string> = {
  0: "Core Terms",
  1: "Investor Highlights",
  2: "Issuer & Paymaster",
  3: "Credit & Invoice Details",
  4: "Financial Review",
  5: "Investor Takeaways",
  6: "Preview & Approval",
};

export function formatProspectusReviewStatus(status: ProspectusReviewStatus): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "READY_FOR_REVIEW":
      return "Ready for Review";
    case "APPROVED":
      return "Approved";
    case "SUPERSEDED":
      return "Superseded";
    default:
      return status;
  }
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

/** True when a string looks like a raw option/field key (underscores / snake_case). */
export function looksLikeRawKey(value: string): boolean {
  return /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(value.trim());
}
