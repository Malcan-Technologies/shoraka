/**
 * Re-export people[] display rules for admin app imports (`@/lib/onboarding-people-display`).
 * Canonical definitions live in `@cashsouk/types` (application-people-display).
 */
export {
  buildDirectorShareholderDisplayRowForEmailEligibility,
  filterVisiblePeopleRows,
  formatPeopleRolesLine,
  formatPeopleRolesLineWithoutShare,
  formatSharePercentageCell,
  getDisplayStatus,
  canManageDirectorShareholder,
  hasActionableDirectorShareholder,
  requiresOnboardingEmail,
  isDirectorShareholderAmlScreeningApproved,
  shouldShowPeopleSendEmailButton,
  isFinancialReviewKycReadyForApprove,
  type ApplicationPersonRow,
  type PeopleRolesRowInput,
} from "@cashsouk/types";
