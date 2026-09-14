export type IssuerDashboardAccountState =
  | "onboarding"
  | "approval"
  | "new"
  | "active"
  | "rejected"
  | "pending_amendment";

const APPROVAL_STATUSES = new Set([
  "PENDING_APPROVAL",
  "PENDING_AML",
  "PENDING_SSM_REVIEW",
  "PENDING_FINAL_APPROVAL",
]);

export function resolveIssuerDashboardState(input: {
  onboardingStep: string;
  onboardingStatus: string | null | undefined;
  applicationCount: number;
  liveNoteCount?: number;
}): IssuerDashboardAccountState {
  const step = input.onboardingStep;
  const status = input.onboardingStatus ?? "";
  const hasBook = input.applicationCount > 0 || (input.liveNoteCount ?? 0) > 0;

  if (step === "rejected" || status === "REJECTED") return "rejected";
  if (status === "PENDING_AMENDMENT") return "pending_amendment";
  if (step === "completed" || status === "COMPLETED") {
    return hasBook ? "active" : "new";
  }
  if (step === "approval" || APPROVAL_STATUSES.has(status)) return "approval";
  return "onboarding";
}

export function onboardingStepCta(stepId: string | undefined): { href: string; label: string } | null {
  switch (stepId) {
    case "tnc":
      return { href: "/onboarding/terms", label: "Continue agreement" };
    case "fee":
      return { href: "/onboarding/fee", label: "Pay fee" };
    case "verify":
      return { href: "/onboarding/verify", label: "Continue onboarding" };
    default:
      return null;
  }
}

export function issuerDashboardSubhead(input: {
  state: IssuerDashboardAccountState;
  remainingOnboardingSteps: number;
  pendingTitle?: string | null;
  nextRepaymentLine?: string | null;
}): string {
  switch (input.state) {
    case "new":
      return "Your business is approved. Start your first financing application.";
    case "approval":
      return "Your submission is complete and under review. Nothing more is needed from you right now.";
    case "onboarding": {
      const remaining = Math.max(0, input.remainingOnboardingSteps);
      if (remaining <= 0) return "Finish setting up your business account to apply for financing.";
      return remaining === 1
        ? "One step left before you can apply for financing."
        : `${remaining} steps left before you can apply for financing.`;
    }
    case "pending_amendment":
      return "Your onboarding was sent back for updates. Complete the updated submission so our team can review it again.";
    case "rejected":
      return "Your onboarding application was rejected. Contact support if you believe this was a mistake.";
    case "active": {
      const parts = [input.pendingTitle?.trim(), input.nextRepaymentLine?.trim()].filter(
        (part): part is string => Boolean(part)
      );
      if (parts.length === 0) return "Manage your financing from here.";
      return parts
        .map((part, index) =>
          index < parts.length - 1 && !/[.!?]$/.test(part) ? `${part}.` : part
        )
        .join(" ");
    }
    default:
      return "Manage your financing from here.";
  }
}

export function resolveOnboardingSubmittedAt(org: object): string | null {
  const record = org as {
    submittedAt?: string | null;
    onboardingSubmittedAt?: string | null;
  };
  const value = record.submittedAt ?? record.onboardingSubmittedAt;
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

export function resolveApprovalReviewIndex(input: {
  onboardingStatus: string | null | undefined;
  ssmChecked?: boolean | null;
  ssmApproved?: boolean | null;
}): number {
  const status = input.onboardingStatus ?? "";
  if (status === "PENDING_FINAL_APPROVAL") return 3;
  if (status === "PENDING_AML") return 2;
  if (status === "PENDING_SSM_REVIEW") return 1;
  if (input.ssmChecked || input.ssmApproved) return 2;
  return 1;
}
