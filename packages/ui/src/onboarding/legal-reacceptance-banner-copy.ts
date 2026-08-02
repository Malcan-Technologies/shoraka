export type LegalReacceptancePortal = "issuer" | "investor";

export function legalReacceptanceBannerTitle(): string {
  return "Legal documents require your attention";
}

export function legalReacceptanceBannerDescription(
  portalType: LegalReacceptancePortal,
  isOwner: boolean
): string {
  if (!isOwner) {
    return "The organisation owner must accept the latest documents before new transactions can continue.";
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
