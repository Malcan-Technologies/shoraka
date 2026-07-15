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

export type OnboardingStepDisplayStatus =
  | "completed"
  | "outstanding"
  | "upcoming"
  | "waiting_admin"
  | "action_required"
  | "failed";

export type OnboardingStepperStep = {
  id: string;
  label: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isRejected?: boolean;
  /** Human-readable gate status derived from backend org state. */
  statusLabel?: string;
  displayStatus?: OnboardingStepDisplayStatus;
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

/** First outstanding onboarding gate for an issuer organization. */
export function getIssuerOnboardingOutstandingStep(
  org: Organization | null | undefined,
  options?: { addingNewOrg?: boolean }
): OnboardingFlowStep {
  return getOnboardingStep(org, "issuer", options);
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

function flowStepToStepperId(flowStep: OnboardingFlowStep): string | null {
  switch (flowStep) {
    case "terms":
      return "tnc";
    case "fee":
      return "fee";
    case "verify":
      return "verify";
    case "approval":
      return "approval";
    case "deposit":
      return "deposit";
    case "rejected":
      return "verify";
    case "completed":
      return null;
    default:
      return null;
  }
}

function isStepRequirementMet(
  stepId: string,
  organization: Organization,
  portalType: PortalType
): boolean {
  switch (stepId) {
    case "tnc":
      return organization.tncAccepted === true;
    case "fee":
      return (
        portalType !== "issuer" ||
        organization.type !== "COMPANY" ||
        Boolean(organization.onboardingFeePaidAt)
      );
    case "verify":
      return isPostRegTank(organization.onboardingStatus);
    case "approval":
      return organization.onboardingStatus === "COMPLETED";
    case "deposit":
      return organization.depositReceived === true;
    default:
      return false;
  }
}

function getStepDisplayStatus(
  stepId: string,
  outstandingFlowStep: OnboardingFlowStep,
  organization: Organization,
  portalType: PortalType,
  isCompleted: boolean,
  isRejected: boolean
): OnboardingStepDisplayStatus {
  if (isCompleted) return "completed";
  if (isRejected) return "failed";

  if (outstandingFlowStep === "rejected") {
    return isStepRequirementMet(stepId, organization, portalType) ? "completed" : "upcoming";
  }

  const outstandingId = flowStepToStepperId(outstandingFlowStep);
  if (outstandingFlowStep === "completed" || !outstandingId) {
    return "completed";
  }

  if (stepId !== outstandingId) {
    return "upcoming";
  }

  if (outstandingFlowStep === "approval") {
    if (organization.onboardingStatus === "PENDING_AMENDMENT") {
      return "action_required";
    }
    return "waiting_admin";
  }

  return "outstanding";
}

function getStepStatusLabel(displayStatus: OnboardingStepDisplayStatus): string {
  switch (displayStatus) {
    case "completed":
      return "Completed";
    case "outstanding":
      return "Outstanding";
    case "waiting_admin":
      return "Waiting for admin approval";
    case "action_required":
      return "Action required";
    case "failed":
      return "Action required";
    case "upcoming":
    default:
      return "";
  }
}

/** Stepper labels for onboarding route pages and dashboard status cards. */
export function getOnboardingStepperSteps(
  organization: Organization,
  portalType: PortalType,
  _currentRouteStep?: OnboardingFlowStep | null
): OnboardingStepperStep[] {
  const outstandingFlowStep = getOnboardingStep(organization, portalType);
  const pipeline = getStepperPipeline(organization, portalType);
  const outstandingId = flowStepToStepperId(outstandingFlowStep);
  const outstandingIndex =
    outstandingId === null ? pipeline.length : pipeline.findIndex((step) => step.id === outstandingId);

  return pipeline.map((step, index) => {
    let isCompleted = false;
    let isCurrent = false;
    let isRejected = false;

    if (outstandingFlowStep === "completed") {
      isCompleted = true;
    } else if (outstandingFlowStep === "rejected") {
      isRejected = step.id === "verify";
      isCompleted =
        isStepRequirementMet(step.id, organization, portalType) && step.id !== "verify";
    } else if (outstandingId && outstandingIndex >= 0) {
      if (index < outstandingIndex) {
        isCompleted = true;
      } else if (step.id === outstandingId) {
        isCurrent = true;
      }
    }

    const displayStatus = getStepDisplayStatus(
      step.id,
      outstandingFlowStep,
      organization,
      portalType,
      isCompleted,
      isRejected
    );

    const statusLabel = getStepStatusLabel(displayStatus);

    return {
      id: step.id,
      label: step.label,
      isCompleted,
      isCurrent,
      isRejected,
      statusLabel: statusLabel || undefined,
      displayStatus,
    };
  });
}
