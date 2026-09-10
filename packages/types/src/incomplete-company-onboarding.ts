/**
 * Resume-or-create-separate matching for company onboarding.
 * Company name is a display field (trim + case-insensitive). Identity remains organization id.
 */

export const RESUMABLE_INCOMPLETE_COMPANY_ONBOARDING_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
] as const;

export type ResumableIncompleteCompanyOnboardingStatus =
  (typeof RESUMABLE_INCOMPLETE_COMPANY_ONBOARDING_STATUSES)[number];

export function normalizeOrganizationDisplayName(name: string): string {
  return name.trim().toLowerCase();
}

export function organizationDisplayNamesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (a == null || b == null) return false;
  const left = normalizeOrganizationDisplayName(a);
  const right = normalizeOrganizationDisplayName(b);
  if (!left || !right) return false;
  return left === right;
}

export function isResumableIncompleteCompanyOnboardingStatus(
  status: string | null | undefined
): boolean {
  const s = String(status ?? "").toUpperCase();
  return (
    s === "PENDING" || s === "IN_PROGRESS"
  );
}
