import {
  filterVisiblePeopleRows,
  isDirectorShareholderAmlScreeningApproved,
  isReadyOnboardingStatus,
  type ApplicationPersonRow,
} from "@cashsouk/types";

/** Listing chip, application detail header chip, Financial Approve disabled label. */
export const ADMIN_DIRECTOR_SHAREHOLDER_PENDING_LABEL = "Director/Shareholder Pending";

/** Fallback when people[] cannot name the incomplete parties. */
export const ADMIN_DIRECTOR_SHAREHOLDER_REVIEW_HINT =
  "Related parties have incomplete onboarding or AML checks. Review their status below.";

function partyDisplayName(person: ApplicationPersonRow): string {
  const name = String(person.name ?? "").trim();
  return name || "Related party";
}

function incompletePartyLine(person: ApplicationPersonRow): string | null {
  const onboardingPending = !isReadyOnboardingStatus(person.onboarding?.status);
  const amlPending = !isDirectorShareholderAmlScreeningApproved(person.screening);
  if (!onboardingPending && !amlPending) return null;
  const name = partyDisplayName(person);
  if (onboardingPending && amlPending) {
    return `${name} — onboarding pending in RegTank; AML pending`;
  }
  if (onboardingPending) return `${name} — onboarding pending in RegTank`;
  return `${name} — AML pending`;
}

/**
 * Explains why director/shareholder review is pending using existing people[] status fields.
 * Does not change who is pending — {@link filterVisiblePeopleRows} + the same onboarding/AML checks
 * as {@link computeHasPendingDirectorShareholder}.
 */
export function formatDirectorShareholderReviewHint(
  people?: ReadonlyArray<ApplicationPersonRow | null | undefined> | null
): string {
  const visible = filterVisiblePeopleRows(
    (people ?? []).filter((p): p is ApplicationPersonRow => p != null)
  );
  const lines = visible
    .map((person) => incompletePartyLine(person))
    .filter((line): line is string => Boolean(line));
  if (lines.length === 0) return ADMIN_DIRECTOR_SHAREHOLDER_REVIEW_HINT;
  const header =
    lines.length === 1
      ? "1 related party requires attention:"
      : `${lines.length} related parties require attention:`;
  return `${header}\n${lines.map((line) => `- ${line}`).join("\n")}`;
}
