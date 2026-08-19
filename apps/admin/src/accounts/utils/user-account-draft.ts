import type { UserDetailResponse } from "@cashsouk/types";

export type UserAccountDraft = {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  investorOnboarded: boolean;
  issuerOnboarded: boolean;
};

export type UserAccountSection = "profile" | "onboarding";

const USER_ID_PATTERN = /^[A-Z]{5}$/;

export function buildUserAccountDraft(user: UserDetailResponse): UserAccountDraft {
  return {
    userId: user.user_id ?? "",
    firstName: user.first_name ?? "",
    lastName: user.last_name ?? "",
    phone: user.phone ?? "",
    investorOnboarded: user.investor_account.length > 0,
    issuerOnboarded: user.issuer_account.length > 0,
  };
}

export function normalizeUserId(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidUserId(value: string): boolean {
  return USER_ID_PATTERN.test(normalizeUserId(value));
}

export function userIdValidationMessage(value: string): string | null {
  return isValidUserId(value) ? null : "User ID must be exactly 5 uppercase letters.";
}

export function hasProfileChanges(draft: UserAccountDraft, original: UserAccountDraft): boolean {
  return (
    normalizeUserId(draft.userId) !== normalizeUserId(original.userId) ||
    draft.firstName !== original.firstName ||
    draft.lastName !== original.lastName ||
    draft.phone !== original.phone
  );
}

export function hasOnboardingChanges(draft: UserAccountDraft, original: UserAccountDraft): boolean {
  return (
    draft.investorOnboarded !== original.investorOnboarded ||
    draft.issuerOnboarded !== original.issuerOnboarded
  );
}

export function sectionHasChanges(
  section: UserAccountSection,
  draft: UserAccountDraft,
  original: UserAccountDraft
): boolean {
  return section === "profile"
    ? hasProfileChanges(draft, original)
    : hasOnboardingChanges(draft, original);
}

export function buildOnboardingPayload(draft: UserAccountDraft, original: UserAccountDraft) {
  return {
    investorOnboarded:
      draft.investorOnboarded !== original.investorOnboarded ? draft.investorOnboarded : undefined,
    issuerOnboarded:
      draft.issuerOnboarded !== original.issuerOnboarded ? draft.issuerOnboarded : undefined,
  };
}
