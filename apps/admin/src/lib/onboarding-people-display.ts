/**
 * Re-export people[] display rules for admin app imports (`@/lib/onboarding-people-display`).
 * Canonical definitions live in `@cashsouk/types` (application-people-display).
 */
export {
  filterVisiblePeopleRows,
  formatPeopleRolesLine,
  formatPeopleRolesLineWithoutShare,
  formatSharePercentageCell,
  getDisplayStatus,
  requiresOnboardingEmail,
  isDirectorShareholderNotifyRowEnabled,
  isNotifyEligible,
  isDirectorShareholderAmlScreeningApproved,
  shouldShowPeopleSendEmailButton,
  isFinancialReviewKycReadyForApprove,
  type ApplicationPersonRow,
  type PeopleRolesRowInput,
} from "@cashsouk/types";
