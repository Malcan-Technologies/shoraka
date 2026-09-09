import { readFileSync } from "node:fs";
import { join } from "node:path";

const pageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const newSource = readFileSync(
  join(__dirname, "../components/dashboard/investor-dashboard-new.tsx"),
  "utf8"
);
const approvalSource = readFileSync(
  join(__dirname, "../components/dashboard/investor-dashboard-approval.tsx"),
  "utf8"
);
const onboardingSource = readFileSync(
  join(__dirname, "../components/dashboard/investor-dashboard-onboarding.tsx"),
  "utf8"
);

describe("investor dashboard page", () => {
  it("keeps onboarding redirects and resolves account state from getOnboardingStep", () => {
    expect(pageSource).toContain("getOnboardingStepRoute");
    expect(pageSource).toContain('getOnboardingStep(activeOrganization, "investor")');
    expect(pageSource).toContain("resolveInvestorDashboardState");
    expect(pageSource).toContain('enabled={dashboardState === "active"}');
    expect(pageSource).toContain("MARKETPLACE_MIN_COMMIT_MYR");
    expect(pageSource).toContain("FINANCING_TENURE_MIN_DAYS");
    expect(pageSource).toContain("FINANCING_TENURE_MAX_DAYS");
    expect(pageSource).toContain("<InvestNowButton");
    expect(pageSource).toMatch(/variant="outline"[\s\S]*Deposit[\s\S]*<InvestNowButton/);
  });

  it("omits fake ONB references, SLA dates, and the mock RM 1,000 minimum", () => {
    expect(pageSource).not.toContain("ONB-");
    expect(pageSource).not.toContain("Expected decision");
    expect(pageSource).not.toContain("one business day");
    expect(pageSource).not.toMatch(/RM 1,000/);
    expect(approvalSource).not.toContain("ONB-");
    expect(approvalSource).not.toContain("Expected decision");
    expect(approvalSource).not.toContain("one business day");
    expect(newSource).toContain("minCommitMyr");
    expect(newSource).not.toMatch(/RM 1,000/);
    expect(onboardingSource).not.toMatch(/RM 1,000/);
    expect(onboardingSource).toContain("tenorLabel");
  });
});
