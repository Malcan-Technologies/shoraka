import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  legalReacceptanceBannerCtaLabel,
  legalReacceptanceBannerDescription,
  legalReacceptanceBannerShellClassName,
  legalReacceptanceBannerTitle,
  shouldShowLegalReacceptanceBanner,
} from "./legal-reacceptance-banner-copy";

describe("LegalReacceptanceBanner copy and layout helpers", () => {
  const source = readFileSync(join(__dirname, "legal-reacceptance-banner.tsx"), "utf8");

  it("uses the shared attention title for owners", () => {
    expect(legalReacceptanceBannerTitle(true)).toBe("Legal documents require your attention");
    expect(legalReacceptanceBannerTitle(false)).toBe("Legal documents require acceptance");
  });

  it("uses issuer financing copy and investor investment copy for owners", () => {
    expect(legalReacceptanceBannerDescription("issuer", true)).toContain("financing");
    expect(legalReacceptanceBannerDescription("issuer", true)).not.toContain("updated");
    expect(legalReacceptanceBannerDescription("investor", true)).toContain("investment");
    expect(legalReacceptanceBannerDescription("investor", true)).not.toContain("updated");
  });

  it("keeps a short non-owner message without saying updated", () => {
    const text = legalReacceptanceBannerDescription("issuer", false);
    expect(text).toContain("organization owner");
    expect(text).not.toContain("updated");
  });

  it("links Review documents to /legal-updates", () => {
    expect(legalReacceptanceBannerCtaLabel(true)).toBe("Review documents");
    expect(source).toContain('href="/legal-updates"');
  });

  it("renders only when pending acceptance exists", () => {
    expect(source).toContain("hasPendingReacceptance");
    expect(source).toContain("if (!eligible || !pending || !activeOrganization) return null");
  });

  it("hides banner for incomplete organizations and onboarding routes", () => {
    expect(
      shouldShowLegalReacceptanceBanner({
        hasOrganization: true,
        onboardingStatus: "IN_PROGRESS",
        tncAccepted: true,
        pathname: "/",
      })
    ).toBe(false);
    expect(
      shouldShowLegalReacceptanceBanner({
        hasOrganization: true,
        onboardingStatus: "COMPLETED",
        tncAccepted: true,
        pathname: "/onboarding/terms",
      })
    ).toBe(false);
    expect(
      shouldShowLegalReacceptanceBanner({
        hasOrganization: true,
        onboardingStatus: "COMPLETED",
        tncAccepted: true,
        pathname: "/onboarding/account",
      })
    ).toBe(false);
    expect(
      shouldShowLegalReacceptanceBanner({
        hasOrganization: false,
        onboardingStatus: "COMPLETED",
        tncAccepted: true,
        pathname: "/",
      })
    ).toBe(false);
    expect(
      shouldShowLegalReacceptanceBanner({
        hasOrganization: true,
        onboardingStatus: "COMPLETED",
        tncAccepted: true,
        pathname: "/",
      })
    ).toBe(true);
  });

  it("uses a compact inline card on desktop and stacks on mobile", () => {
    expect(source).toContain("sm:flex-row sm:items-center");
    expect(source).toContain("flex-col gap-3");
    expect(source).toContain("w-full shrink-0 sm:w-auto");
    expect(source).toContain("ExclamationTriangleIcon");
    expect(source).toContain("rounded-xl border border-amber-200");
    expect(source).not.toContain("border-b border-border bg-muted/60");
    expect(source).not.toContain("max-w-6xl");
    expect(source).not.toContain("justify-between");
  });

  it("matches issuer and investor dashboard gutters", () => {
    expect(legalReacceptanceBannerShellClassName("issuer")).toContain("px-6");
    expect(legalReacceptanceBannerShellClassName("issuer")).toContain("lg:px-10");
    expect(legalReacceptanceBannerShellClassName("investor")).toContain("px-4");
  });

  it("does not change acceptance API paths or transaction guards", () => {
    expect(source).toContain("/v1/legal-documents/acceptance-status");
    expect(source).not.toContain("transaction");
    expect(source).not.toContain("block");
  });
});
