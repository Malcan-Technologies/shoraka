import type { OnboardingStatus, Organization, PortalType } from "./organization-context";

/**
 * Shared onboarding action labels. Keep button/loading text identical across the admin,
 * investor, and issuer portals so the same action reads the same way everywhere.
 */
export const ONBOARDING_REFRESH_LABEL = "Refresh status";
export const ONBOARDING_REFRESH_LOADING_LABEL = "Refreshing…";
export const ONBOARDING_OPEN_REGTANK_REVIEW_LABEL = "Open RegTank Review";
export const ONBOARDING_RESTART_LABEL = "Restart Onboarding";

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
const APPLICANT_ACCOUNT_ACCESS_STATUSES: OnboardingStatus[] = [
  "PENDING_AML",
  "PENDING_FINAL_APPROVAL",
  "COMPLETED",
];

function isAdminPending(status: OnboardingStatus): boolean {
  return ADMIN_PENDING_STATUSES.includes(status);
}

export function isOrganizationAdminWaitStatus(status: OnboardingStatus): boolean {
  return ORG_SWITCHER_ADMIN_WAIT_STATUSES.includes(status);
}

/**
 * Account/Profile access for applicant portals should be driven by organization onboarding status.
 * RegTank transport status is not the source of truth for this gate.
 */
export function canAccessApplicantAccount(
  status: OnboardingStatus | null | undefined
): boolean {
  if (!status) return false;
  return APPLICANT_ACCOUNT_ACCESS_STATUSES.includes(status);
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

  // Required gates use their own fields — never skip them because status is COMPLETED.
  if (!org.tncAccepted) {
    return "terms";
  }

  if (portalType === "issuer" && org.type === "COMPANY" && !org.onboardingFeePaidAt) {
    return "fee";
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

type StepperPipelineStep = {
  id: string;
  label: string;
};

function getStepperPipeline(organization: Organization, portalType: PortalType): StepperPipelineStep[] {
  const pipeline: StepperPipelineStep[] = [{ id: "tnc", label: "User Agreement" }];

  if (portalType === "issuer" && organization.type === "COMPANY") {
    pipeline.push({ id: "fee", label: "Onboarding Fee" });
  }

  pipeline.push({ id: "verify", label: "Onboarding" }, { id: "approval", label: "Approval" });

  if (portalType === "investor") {
    pipeline.push({ id: "deposit", label: "Deposit" });
  }

  return pipeline;
}

function isStepCompletedFromDb(stepId: string, organization: Organization): boolean {
  switch (stepId) {
    case "tnc":
      return organization.tncAccepted === true;
    case "fee":
      return Boolean(organization.onboardingFeePaidAt);
    case "verify":
      // Post-RegTank admin-wait / completed statuses mean verification was submitted.
      return isPostRegTank(organization.onboardingStatus);
    case "approval":
      // Existing app rule: final admin approval is represented by COMPLETED.
      return organization.onboardingStatus === "COMPLETED";
    case "deposit":
      return organization.depositReceived === true;
    default:
      return false;
  }
}

function isStepRejectedFromDb(stepId: string, organization: Organization): boolean {
  return stepId === "verify" && organization.onboardingStatus === "REJECTED";
}

/** Stepper labels for onboarding route pages and dashboard status cards. */
export function getOnboardingStepperSteps(
  organization: Organization,
  portalType: PortalType,
  _currentRouteStep?: OnboardingFlowStep | null
): OnboardingStepperStep[] {
  const pipeline = getStepperPipeline(organization, portalType);
  const isOrgRejected = organization.onboardingStatus === "REJECTED";

  const steps = pipeline.map((step) => {
    const isRejected = isStepRejectedFromDb(step.id, organization);
    const isCompleted = !isRejected && isStepCompletedFromDb(step.id, organization);

    return {
      id: step.id,
      label: step.label,
      isCompleted,
      isCurrent: false,
      isRejected,
    };
  });

  // Rejected orgs keep origin/main routing (dashboard). Do not mark an earlier
  // incomplete step as current — only show accurate completed/rejected flags.
  if (isOrgRejected) {
    return steps;
  }

  // Non-rejected: current = first required step whose own DB fields say incomplete.
  const currentIndex = steps.findIndex((step) => !step.isCompleted);
  if (currentIndex >= 0) {
    steps[currentIndex].isCurrent = true;
  }

  return steps;
}
