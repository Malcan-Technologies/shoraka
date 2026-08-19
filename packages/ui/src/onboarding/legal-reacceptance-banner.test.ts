import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  legalReacceptanceBannerCtaLabel,
  legalReacceptanceBannerDescription,
  legalReacceptanceBannerShellClassName,
  legalReacceptanceBannerTitle,
  shouldShowLegalReacceptanceBanner,
} from "./legal-reacceptance-banner-copy";
import { LEGAL_REACCEPTANCE_REDIRECT } from "./use-legal-reacceptance-gate";

describe("LegalReacceptanceBanner copy and layout helpers", () => {
  const source = readFileSync(join(__dirname, "legal-reacceptance-banner.tsx"), "utf8");

  it("uses the shared attention title", () => {
    expect(legalReacceptanceBannerTitle(true)).toBe("Legal documents require your attention");
    expect(legalReacceptanceBannerTitle(false)).toBe("Legal documents require your attention");
  });

  it("uses issuer financing copy and investor investment copy for owners", () => {
    expect(legalReacceptanceBannerDescription("issuer", true)).toContain("financing");
    expect(legalReacceptanceBannerDescription("issuer", true)).not.toContain("updated");
    expect(legalReacceptanceBannerDescription("investor", true)).toContain("investment");
    expect(legalReacceptanceBannerDescription("investor", true)).not.toContain("updated");
  });

  it("asks every member to review and accept", () => {
    const text = legalReacceptanceBannerDescription("issuer", false);
    expect(text).toContain("Review and accept");
    expect(text).not.toContain("organization owner");
    expect(legalReacceptanceBannerCtaLabel(false)).toBe("Review documents");
  });

  it("links Review documents to /legal-updates", () => {
    expect(legalReacceptanceBannerCtaLabel(true)).toBe("Review documents");
    expect(LEGAL_REACCEPTANCE_REDIRECT).toBe("/legal-updates");
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
        pathname: "/",
      })
    ).toBe(true);
  });

  it("uses a compact inline card on desktop and stacks on mobile", () => {
    expect(source).toContain("sm:flex-row sm:items-center");
    expect(source).toContain("flex-col gap-3");
    expect(source).toContain("w-full shrink-0 sm:w-auto");
    expect(source).toContain("ExclamationTriangleIcon");
    expect(source).toContain("rounded-xl border border-status-action-text/30 bg-status-action-bg");
  });

  it("matches issuer and investor dashboard gutters", () => {
    expect(legalReacceptanceBannerShellClassName("issuer")).toContain("px-6");
    expect(legalReacceptanceBannerShellClassName("issuer")).toContain("lg:px-10");
    expect(legalReacceptanceBannerShellClassName("investor")).toContain("px-4");
  });
});
