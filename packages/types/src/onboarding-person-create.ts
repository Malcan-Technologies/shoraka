import {
  requiredEmailIssue,
  requiredTextIssue,
  type ComrepFieldIssue,
} from "./comrep-requiredness";
import { issuerShareholdingThresholdIssue } from "./issuer-shareholder-threshold";

function push(issues: ComrepFieldIssue[], issue: ComrepFieldIssue | null): void {
  if (issue) issues.push(issue);
}

function hasIdentityNumber(value: unknown): boolean {
  return String(value ?? "").trim().length > 0;
}

export const ADD_COMPANY_PERSON_ONBOARDING_HELP =
  "Add this person to the company profile and send them a RegTank onboarding link.";

export const ADD_COMPANY_PERSON_MANUAL_HELP =
  "Add this person to the company profile. This does not create a CashSouk login.";

type AddCompanyPersonRoleInput = {
  entityType?: unknown;
  identityPrefix?: unknown;
  isDirector?: boolean;
  isShareholder?: boolean;
};

function resolvedEntityType(value: AddCompanyPersonRoleInput): "INDIVIDUAL" | "CORPORATE" {
  return value.entityType === "CORPORATE" || value.identityPrefix === "ROC" ? "CORPORATE" : "INDIVIDUAL";
}

/**
 * Individual Director or Shareholder uses the RegTank onboarding-link flow.
 * Board of Director / Management Team without those roles stay on the manual form.
 * Corporate shareholders keep the existing full create path (no party-level COD send).
 */
export function addCompanyPersonUsesOnboardingFlow(value: AddCompanyPersonRoleInput): boolean {
  if (resolvedEntityType(value) === "CORPORATE") return false;
  return value.isDirector === true || value.isShareholder === true;
}

/**
 * Individual Director/Shareholder create without government ID.
 * Corporate and identity-provided creates keep the full ComRep form.
 * Board/Management alongside Director/Shareholder still uses this short path.
 */
export function isMinimalOnboardingPersonCreate(value: {
  entityType?: unknown;
  identityPrefix?: unknown;
  identityNumber?: unknown;
  isDirector?: boolean;
  isShareholder?: boolean;
  isBoard?: boolean;
  isManagement?: boolean;
  personKind?: unknown;
}): boolean {
  if (!addCompanyPersonUsesOnboardingFlow(value)) return false;
  if (hasIdentityNumber(value.identityNumber)) return false;
  return true;
}

export function validateOnboardingPersonCreate(input: {
  name?: unknown;
  email?: unknown;
  isShareholder?: boolean;
  shareholdingPercentage?: unknown;
}): ComrepFieldIssue[] {
  const issues: ComrepFieldIssue[] = [];
  push(issues, requiredTextIssue(input.name, "name", "Name"));
  push(issues, requiredEmailIssue(input.email, "email", "Person Email"));
  if (input.isShareholder) {
    push(issues, issuerShareholdingThresholdIssue(input.shareholdingPercentage, { required: true }));
  }
  return issues;
}
