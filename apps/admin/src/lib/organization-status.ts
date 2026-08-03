import type { OnboardingStatusEnum } from "@cashsouk/types";
import type { StatusToken } from "@cashsouk/ui";

type OrgStatusPresentation = {
  label: string;
  status: StatusToken;
};

const ONBOARDING_STATUS: Record<OnboardingStatusEnum, OrgStatusPresentation> = {
  PENDING: { label: "Not Started", status: "neutral" },
  IN_PROGRESS: { label: "In Progress", status: "in-progress" },
  PENDING_APPROVAL: { label: "Pending Approval", status: "submitted" },
  PENDING_AML: { label: "Pending AML", status: "submitted" },
  PENDING_SSM_REVIEW: { label: "Pending SSM", status: "submitted" },
  PENDING_AMENDMENT: { label: "Amendment in Progress", status: "action" },
  PENDING_FINAL_APPROVAL: { label: "Pending Final", status: "submitted" },
  COMPLETED: { label: "Completed", status: "success" },
  REJECTED: { label: "Rejected", status: "rejected" },
};

export function getOrganizationOnboardingPresentation(
  onboardingStatus: OnboardingStatusEnum | string,
  options?: { completedLabel?: string }
): OrgStatusPresentation {
  const mapped = ONBOARDING_STATUS[onboardingStatus as OnboardingStatusEnum];
  if (!mapped) {
    return { label: onboardingStatus, status: "neutral" };
  }
  if (onboardingStatus === "COMPLETED" && options?.completedLabel) {
    return { ...mapped, label: options.completedLabel };
  }
  return mapped;
}

export function getOrganizationTypePresentation(type: "COMPANY" | "PERSONAL" | string): OrgStatusPresentation {
  if (type === "COMPANY") return { label: "Company", status: "submitted" };
  if (type === "PERSONAL") return { label: "Personal", status: "neutral" };
  return { label: type, status: "neutral" };
}

export function getOrganizationRiskPresentation(
  riskLevel: string | null | undefined
): StatusToken {
  const level = riskLevel?.toLowerCase() ?? "";
  if (level.includes("low")) return "success";
  if (level.includes("high")) return "rejected";
  return "action";
}
