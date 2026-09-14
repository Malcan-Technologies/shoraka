export type InvestorDashboardOnboardingStep =
  | "account"
  | "terms"
  | "fee"
  | "verify"
  | "approval"
  | "deposit"
  | "completed"
  | "rejected";

export type InvestorDashboardState = "onboarding" | "approval" | "new" | "active" | "rejected";

const COMPLETED_OR_TERMINAL: ReadonlySet<InvestorDashboardOnboardingStep> = new Set([
  "approval",
  "completed",
  "rejected",
]);

export function resolveInvestorDashboardState(input: {
  step: InvestorDashboardOnboardingStep;
  investmentCount: number;
}): InvestorDashboardState {
  if (input.step === "rejected") return "rejected";
  if (input.step === "approval") return "approval";
  if (input.step === "completed") {
    return input.investmentCount > 0 ? "active" : "new";
  }
  return "onboarding";
}

export function isInvestorDashboardOnboardingStep(
  step: InvestorDashboardOnboardingStep
): boolean {
  return !COMPLETED_OR_TERMINAL.has(step);
}

export function investorDashboardWelcomeSubhead(input: {
  state: InvestorDashboardState;
  remainingStepCount: number;
  next90DayCashflowLabel: string | null;
}): string {
  switch (input.state) {
    case "active":
      if (input.next90DayCashflowLabel) {
        return `Your portfolio is earning. ${input.next90DayCashflowLabel} settles back to your wallet in the next 90 days.`;
      }
      return "Your portfolio is earning. Browse notes when you are ready to commit more capital.";
    case "new":
      return "Your account is approved. Fund the wallet and pick your first note.";
    case "approval":
      return "Your submission is complete and under review. Nothing more is needed from you right now.";
    case "onboarding": {
      const remaining = input.remainingStepCount;
      if (remaining <= 0) return "Complete the remaining steps before you can invest.";
      if (remaining === 1) return "One step left before you can invest.";
      return `${remaining} steps left before you can invest.`;
    }
    case "rejected":
      return "Your onboarding application has been rejected.";
  }
}

export function onboardingStepProgress(steps: readonly { isCompleted: boolean }[]): {
  completed: number;
  total: number;
  percent: number;
} {
  const total = steps.length;
  const completed = steps.filter((step) => step.isCompleted).length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export type ApprovalPipelineStageStatus = "done" | "current" | "pending";

export type ApprovalPipelineStage = {
  id: "documents" | "aml" | "final" | "wallet";
  label: string;
  status: ApprovalPipelineStageStatus;
};

export function approvalPipelineStages(input: {
  onboardingStatus: string;
  amlApproved?: boolean | null;
}): ApprovalPipelineStage[] {
  const amlCurrent = input.onboardingStatus === "PENDING_AML";
  const amlDone =
    !amlCurrent &&
    (input.amlApproved === true ||
      input.onboardingStatus === "PENDING_APPROVAL" ||
      input.onboardingStatus === "PENDING_FINAL_APPROVAL" ||
      input.onboardingStatus === "PENDING_SSM_REVIEW");

  return [
    { id: "documents", label: "Documents received", status: "done" },
    {
      id: "aml",
      label: "AML screening",
      status: amlCurrent ? "current" : amlDone ? "done" : "current",
    },
    {
      id: "final",
      label: "Final approval",
      status: amlCurrent ? "pending" : "current",
    },
    { id: "wallet", label: "Wallet enabled", status: "pending" },
  ];
}

export function currentOnboardingStepHref(stepId: string): string | null {
  switch (stepId) {
    case "tnc":
      return "/onboarding/terms";
    case "fee":
      return "/onboarding/fee";
    case "verify":
      return "/onboarding/verify";
    case "deposit":
      return "#first-deposit";
    default:
      return null;
  }
}

export function currentOnboardingStepHint(stepId: string): string | null {
  switch (stepId) {
    case "tnc":
      return "Review and accept the user agreement.";
    case "fee":
      return "Pay the onboarding fee to continue.";
    case "verify":
      return "You will need your MyKad or passport.";
    case "deposit":
      return "Add funds to your Investor Pool balance to start investing.";
    case "approval":
      return "Your application is with our compliance team.";
    default:
      return null;
  }
}
