import {
  isResumableIncompleteCompanyOnboardingStatus,
  normalizeOrganizationDisplayName,
  organizationDisplayNamesMatch,
} from "./incomplete-company-onboarding";

describe("incomplete company onboarding match helpers", () => {
  it("normalizes with trim and case-insensitive compare", () => {
    expect(normalizeOrganizationDisplayName("  ABC Sdn Bhd ")).toBe("abc sdn bhd");
    expect(organizationDisplayNamesMatch("ABC Sdn Bhd", "abc sdn bhd")).toBe(true);
    expect(organizationDisplayNamesMatch("ABC Sdn Bhd", "  abc sdn bhd  ")).toBe(true);
    expect(organizationDisplayNamesMatch("ABC Sdn Bhd", "XYZ Sdn Bhd")).toBe(false);
    expect(organizationDisplayNamesMatch("", "ABC")).toBe(false);
    expect(organizationDisplayNamesMatch(null, "ABC")).toBe(false);
  });

  it("treats PENDING and IN_PROGRESS as resumable incomplete company statuses", () => {
    expect(isResumableIncompleteCompanyOnboardingStatus("PENDING")).toBe(true);
    expect(isResumableIncompleteCompanyOnboardingStatus("IN_PROGRESS")).toBe(true);
    expect(isResumableIncompleteCompanyOnboardingStatus("pending")).toBe(true);
  });

  it("does not treat completed, rejected, or admin-wait statuses as resumable incomplete", () => {
    expect(isResumableIncompleteCompanyOnboardingStatus("COMPLETED")).toBe(false);
    expect(isResumableIncompleteCompanyOnboardingStatus("REJECTED")).toBe(false);
    expect(isResumableIncompleteCompanyOnboardingStatus("PENDING_APPROVAL")).toBe(false);
    expect(isResumableIncompleteCompanyOnboardingStatus("PENDING_AML")).toBe(false);
    expect(isResumableIncompleteCompanyOnboardingStatus("PENDING_SSM_REVIEW")).toBe(false);
    expect(isResumableIncompleteCompanyOnboardingStatus("PENDING_FINAL_APPROVAL")).toBe(false);
    expect(isResumableIncompleteCompanyOnboardingStatus("PENDING_AMENDMENT")).toBe(false);
  });
});
