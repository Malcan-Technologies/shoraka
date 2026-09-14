import { incompleteCompanyOnboardingDescription } from "./incomplete-company-onboarding-copy";

describe("incomplete company onboarding copy", () => {
  it("names the unfinished company in the confirmation", () => {
    expect(incompleteCompanyOnboardingDescription("ABC Sdn Bhd")).toBe(
      "You already have an unfinished onboarding for “ABC Sdn Bhd”. Would you like to continue that onboarding, or create a separate company?"
    );
  });
});
