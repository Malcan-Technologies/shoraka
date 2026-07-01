import type { OnboardingStatus, Organization, PortalType } from "./organization-context";

/** High-level onboarding destination used for routing and guards. */
export type OnboardingFlowStep =
  | "account"
  | "terms"
  | "fee"
  | "verify"
  | "approval"
  | "deposit"
  | "completed"
  | "rejected";

export type OnboardingStepperStep = {
  id: string;
  label: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isRejected?: boolean;
};

const ADMIN_PENDING_STATUSES: OnboardingStatus[] = [
  "PENDING_APPROVAL",
  "PENDING_AML",
  "PENDING_AMENDMENT",
  "PENDING_SSM_REVIEW",
  "PENDING_FINAL_APPROVAL",
];

/** Admin review only — user has finished onboarding; shown under "Your Organizations". */
const ORG_SWITCHER_ADMIN_WAIT_STATUSES: OnboardingStatus[] = [
  "PENDING_APPROVAL",
  "PENDING_AML",
  "PENDING_FINAL_APPROVAL",
  "PENDING_SSM_REVIEW",
];

const POST_REGTANK_STATUSES: OnboardingStatus[] = [...ADMIN_PENDING_STATUSES, "COMPLETED"];

function isAdminPending(status: OnboardingStatus): boolean {
  return ADMIN_PENDING_STATUSES.includes(status);
}

export function isOrganizationAdminWaitStatus(status: OnboardingStatus): boolean {
  return ORG_SWITCHER_ADMIN_WAIT_STATUSES.includes(status);
}

/** Ready or awaiting admin review — not user-action onboarding steps. */
export function isOrganizationInYourOrganizationsSection(org: Organization): boolean {
  if (org.onboardingStatus === "COMPLETED") return true;
  return isOrganizationAdminWaitStatus(org.onboardingStatus);
}

export function isOrganizationActionRequired(org: Organization): boolean {
  return !isOrganizationInYourOrganizationsSection(org);
}

/** COMPLETED orgs first, then admin-wait; personal accounts before company within each tier. */
export function sortYourOrganizations(orgs: Organization[]): Organization[] {
  return [...orgs].sort((a, b) => {
    const aCompleted = a.onboardingStatus === "COMPLETED" ? 0 : 1;
    const bCompleted = b.onboardingStatus === "COMPLETED" ? 0 : 1;
    if (aCompleted !== bCompleted) return aCompleted - bCompleted;
    if (a.type === "PERSONAL" && b.type !== "PERSONAL") return -1;
    if (a.type !== "PERSONAL" && b.type === "PERSONAL") return 1;
    return 0;
  });
}

function isPostRegTank(status: OnboardingStatus): boolean {
  return POST_REGTANK_STATUSES.includes(status);
}

/** Maps the active organization to the step the user should be on. */
export function getOnboardingStep(
  org: Organization | null | undefined,
  portalType: PortalType,
  options?: { addingNewOrg?: boolean }
): OnboardingFlowStep {
  if (options?.addingNewOrg || !org) {
    return "account";
  }

  if (org.onboardingStatus === "REJECTED") {
    return "rejected";
  }

  if (portalType === "investor") {
    if (org.onboardingStatus === "COMPLETED") {
      return org.depositReceived ? "completed" : "deposit";
    }
  } else if (org.onboardingStatus === "COMPLETED") {
    return "completed";
  }

  if (isAdminPending(org.onboardingStatus)) {
    return "approval";
  }

  if (!org.tncAccepted) {
    return "terms";
  }

  if (portalType === "issuer" && org.type === "COMPANY" && !org.onboardingFeePaidAt) {
    return "fee";
  }

  if (!isPostRegTank(org.onboardingStatus)) {
    return "verify";
  }

  return "approval";
}

/** Route path for a flow step. Approval, deposit, and terminal states live on the dashboard. */
export function getOnboardingStepRoute(step: OnboardingFlowStep): string {
  switch (step) {
    case "account":
      return "/onboarding/account";
    case "terms":
      return "/onboarding/terms";
    case "fee":
      return "/onboarding/fee";
    case "verify":
      return "/onboarding/verify";
    case "approval":
    case "deposit":
    case "completed":
    case "rejected":
      return "/";
    default:
      return "/";
  }
}

export function getOnboardingRouteForOrg(
  org: Organization | null | undefined,
  portalType: PortalType,
  options?: { addingNewOrg?: boolean }
): string {
  return getOnboardingStepRoute(getOnboardingStep(org, portalType, options));
}

export function getOnboardingRouteStep(pathname: string): OnboardingFlowStep | null {
  if (pathname === "/onboarding/account") return "account";
  if (pathname === "/onboarding/terms") return "terms";
  if (pathname === "/onboarding/fee") return "fee";
  if (pathname === "/onboarding/verify") return "verify";
  return null;
}

export function isOnboardingAppRoute(pathname: string): boolean {
  return pathname.startsWith("/onboarding");
}

/** True only on the welcome / add-organization step (legacy onboarding-start). */
export function isAddingNewOrganizationRoute(pathname: string): boolean {
  return pathname === "/onboarding/account";
}

/** Stepper labels for onboarding route pages and dashboard status cards. */
export function getOnboardingStepperSteps(
  organization: Organization,
  portalType: PortalType,
  currentRouteStep?: OnboardingFlowStep | null
): OnboardingStepperStep[] {
  const isRejected = organization.onboardingStatus === "REJECTED";
  const isCompany = organization.type === "COMPANY";

  const tncComplete = !isRejected && organization.tncAccepted === true;
  const feeComplete =
    !isRejected &&
    (portalType !== "issuer" || !isCompany || Boolean(organization.onboardingFeePaidAt));
  const verifyComplete = !isRejected && isPostRegTank(organization.onboardingStatus);
  const accountApprovalComplete = organization.onboardingStatus === "COMPLETED";
  const depositComplete = organization.depositReceived === true;

  const flowStep = getOnboardingStep(organization, portalType);
  const currentStepId = (() => {
    if (isRejected) return "";
    if (currentRouteStep && ["account", "terms", "fee", "verify"].includes(currentRouteStep)) {
      return currentRouteStep;
    }
    if (flowStep === "terms") return "tnc";
    if (flowStep === "fee") return "fee";
    if (flowStep === "verify") return "verify";
    if (flowStep === "approval") return "approval";
    if (flowStep === "deposit") return "deposit";
    return "";
  })();

  const steps: OnboardingStepperStep[] = [
    {
      id: "tnc",
      label: "User Agreement",
      isCompleted: tncComplete,
      isCurrent: currentStepId === "tnc" || currentStepId === "terms",
    },
  ];

  if (portalType === "issuer" && isCompany) {
    steps.push({
      id: "fee",
      label: "Onboarding Fee",
      isCompleted: feeComplete,
      isCurrent: currentStepId === "fee",
    });
  }

  steps.push({
    id: "verify",
    label: "Onboarding",
    isCompleted: verifyComplete,
    isCurrent: currentStepId === "verify",
    isRejected,
  });

  steps.push({
    id: "approval",
    label: "Approval",
    isCompleted: accountApprovalComplete,
    isCurrent: currentStepId === "approval",
  });

  if (portalType === "investor") {
    steps.push({
      id: "deposit",
      label: "Deposit",
      isCompleted: depositComplete,
      isCurrent: currentStepId === "deposit",
    });
  }

  return steps;
}
