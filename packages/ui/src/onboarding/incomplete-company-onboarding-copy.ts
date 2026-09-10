export function incompleteCompanyOnboardingTitle(): string {
  return "Unfinished onboarding";
}

export function incompleteCompanyOnboardingDescription(companyName: string): string {
  const name = companyName.trim() || "this company";
  return `You already have an unfinished onboarding for “${name}”. Would you like to continue that onboarding, or create a separate company?`;
}
