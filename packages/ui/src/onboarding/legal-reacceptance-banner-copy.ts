export type LegalReacceptancePortal = "issuer" | "investor";

export function legalReacceptanceBannerTitle(isOwner: boolean): string {
  return isOwner
    ? "Legal documents require your attention"
    : "Legal documents require acceptance";
}

export function legalReacceptanceBannerDescription(
  portalType: LegalReacceptancePortal,
  isOwner: boolean
): string {
  if (!isOwner) {
    return "Your organization owner must review and accept the latest legal documents before new transactions can begin.";
  }
  if (portalType === "issuer") {
    return "Review and accept the latest documents before starting a new financing application.";
  }
  return "Review and accept the latest documents before making a new investment.";
}

export function legalReacceptanceBannerCtaLabel(isOwner: boolean): string {
  return isOwner ? "Review documents" : "View documents";
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
