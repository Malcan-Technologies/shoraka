import { readFileSync } from "node:fs";
import { join } from "node:path";

const pageSource = readFileSync(join(__dirname, "../../app/page.tsx"), "utf8");
const onboardingSource = readFileSync(join(__dirname, "./issuer-dashboard-onboarding.tsx"), "utf8");
const approvalSource = readFileSync(join(__dirname, "./issuer-dashboard-approval.tsx"), "utf8");
const newSource = readFileSync(join(__dirname, "./issuer-dashboard-new.tsx"), "utf8");
const activeSource = readFileSync(join(__dirname, "./issuer-dashboard-active.tsx"), "utf8");
const metricsSource = readFileSync(join(__dirname, "./issuer-dashboard-metric-cards.tsx"), "utf8");
const standSource = readFileSync(join(__dirname, "./where-things-stand-card.tsx"), "utf8");
const bannerSource = readFileSync(join(__dirname, "./next-action-banner.tsx"), "utf8");
const chartsSource = readFileSync(join(__dirname, "./issuer-dashboard-charts.tsx"), "utf8");
const stateSource = readFileSync(join(__dirname, "./resolve-issuer-dashboard-state.ts"), "utf8");

describe("issuer dashboard layout", () => {
  it("keeps onboarding redirects and layout wrappers", () => {
    expect(pageSource).toContain("getOnboardingStep");
    expect(pageSource).toContain("getOnboardingStepRoute");
    expect(pageSource).toContain('flowStep === "terms" || flowStep === "fee" || flowStep === "verify"');
    expect(pageSource).toContain("issuerMainContentClassName");
    expect(pageSource).toContain("issuerPageGutterClassName");
    expect(pageSource).toContain("resolveIssuerDashboardState");
    expect(pageSource).toContain("DirectorShareholderAlertCard");
  });

  it("renders the four account-state sections", () => {
    expect(pageSource).toContain("IssuerDashboardOnboarding");
    expect(pageSource).toContain("IssuerDashboardApproval");
    expect(pageSource).toContain("IssuerDashboardNew");
    expect(pageSource).toContain("IssuerDashboardActive");
    expect(onboardingSource).toContain("Finish setting up your business account");
    expect(onboardingSource).toContain("What unlocks when you finish");
    expect(approvalSource).toContain("We are verifying your business");
    expect(approvalSource).toContain("Get ready to apply");
    expect(newSource).toContain("Turn an unpaid invoice into cash");
    expect(activeSource).toContain("WhereThingsStandCard");
    expect(activeSource).toContain("IssuerDashboardFundingProgress");
    expect(standSource).toContain("Where things stand");
    expect(standSource).toContain("originationKindLabel");
    expect(standSource).toContain("All applications");
    expect(standSource).not.toContain("resolveApplicationPipeline");
    expect(metricsSource).toContain("Outstanding financing");
    expect(metricsSource).toContain("Next repayment");
    expect(metricsSource).toContain("Available limit");
    expect(metricsSource).toContain("Repayment record");
  });

  it("does not invent indicative 500k, ONB ids, expected-decision, or time-to-funding", () => {
    expect(newSource).not.toContain("500,000");
    expect(newSource).not.toContain("Indicative limit");
    expect(newSource).not.toContain("Time to funding");
    expect(newSource).not.toContain("5–9");
    expect(approvalSource).not.toContain("Expected decision");
    expect(approvalSource).not.toContain("ONB");
    expect(pageSource).not.toContain("ONB-");
    expect(pageSource).not.toContain("500,000");
    expect(stateSource).not.toContain("ONB");
  });

  it("hides the outstanding chart without two points and shows cost of financing", () => {
    expect(chartsSource).toContain("points.length < 2");
    expect(chartsSource).toContain("ReferenceLine");
    expect(chartsSource).toContain("AreaChart");
    expect(activeSource).toContain("IssuerDashboardCostOfFinancing");
    expect(activeSource).toContain("costOfFinancingYtd");
  });

  it("restyles the pending-action banner without inventing expiry", () => {
    expect(bannerSource).toContain("bg-status-action-bg");
    expect(bannerSource).not.toContain("expires in");
    expect(pageSource).toContain("pickIssuerDashboardPendingAction");
    expect(pageSource).not.toContain("expires in");
  });
});
