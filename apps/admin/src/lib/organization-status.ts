import type { OnboardingStatusEnum } from "@cashsouk/types";
import type { StatusToken } from "@cashsouk/ui";

type OrgStatusPresentation = {
  label: string;
  status: StatusToken;
};

const ONBOARDING_STATUS: Record<OnboardingStatusEnum, OrgStatusPresentation> = {
  PENDING: { label: "Not Started", status: "neutral" },
  IN_PROGRESS: { label: "In Progress", status: "submitted" },
  PENDING_APPROVAL: { label: "Pending Approval", status: "action" },
  PENDING_AML: { label: "Pending AML", status: "action" },
  PENDING_SSM_REVIEW: { label: "Pending SSM", status: "action" },
  PENDING_AMENDMENT: { label: "Amendment in Progress", status: "submitted" },
  PENDING_FINAL_APPROVAL: { label: "Pending Final", status: "action" },
  COMPLETED: { label: "Completed", status: "success" },
  REJECTED: { label: "Rejected", status: "rejected" },
};

const QUEUE_STATUS: Record<string, OrgStatusPresentation> = {
  PENDING_ONBOARDING: { label: "In Progress", status: "submitted" },
  EXPIRED: { label: "Expired", status: "rejected" },
  CANCELLED: { label: "Cancelled", status: "neutral" },
};

export function getOnboardingQueuePresentation(
  status: string
): OrgStatusPresentation {
  return (
    QUEUE_STATUS[status] ??
    getOrganizationOnboardingPresentation(status)
  );
}

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
