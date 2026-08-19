export type LegalReacceptancePortal = "issuer" | "investor";

export function legalReacceptanceBannerTitle(_isOwner: boolean): string {
  return "Legal documents require your attention";
}

export function legalReacceptanceBannerDescription(
  portalType: LegalReacceptancePortal,
  _isOwner: boolean
): string {
  if (portalType === "issuer") {
    return "Review and accept the latest documents before starting a new financing application.";
  }
  return "Review and accept the latest documents before making a new investment.";
}

export function legalReacceptanceBannerCtaLabel(_isOwner: boolean): string {
  return "Review documents";
}

/** Horizontal padding aligned with each portal’s dashboard gutters. */
export function legalReacceptanceBannerShellClassName(
  portalType: LegalReacceptancePortal
): string {
  if (portalType === "issuer") {
    return "w-full min-w-0 px-6 pt-6 sm:px-8 sm:pt-8 lg:px-10";
  }
  return "w-full min-w-0 px-4 pt-4";
}

/**
 * Client-side gate before calling the pending API.
 * Primary rule: organization onboarding_status must be COMPLETED.
 * Route checks are an extra UI safeguard during create/onboarding flows.
 */
export function shouldShowLegalReacceptanceBanner(input: {
  hasOrganization: boolean;
  onboardingStatus: string | null | undefined;
  tncAccepted: boolean | null | undefined;
  pathname: string | null | undefined;
}): boolean {
  if (!input.hasOrganization) return false;
  if (input.onboardingStatus !== "COMPLETED") return false;
  if (!input.tncAccepted) return false;

  const path = input.pathname ?? "";
  if (path.startsWith("/onboarding")) return false;
  if (path === "/legal-updates") return false;

  return true;
}
