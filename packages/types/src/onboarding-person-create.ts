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

/**
 * Individual Director/Shareholder create without government ID.
 * Corporate, Board, Management, and identity-provided creates keep the full ComRep form.
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
  const entityType =
    value.entityType === "CORPORATE" || value.identityPrefix === "ROC" ? "CORPORATE" : "INDIVIDUAL";
  if (entityType === "CORPORATE") return false;
  const officer =
    value.isBoard === true ||
    value.isManagement === true ||
    value.personKind === "BOARD" ||
    value.personKind === "MANAGEMENT";
  if (officer) return false;
  if (value.isDirector !== true && value.isShareholder !== true) return false;
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
