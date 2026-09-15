import { test, expect, Page } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || "",
  password: process.env.TEST_USER_PASSWORD || "",
};

const hasAuthCredentials = Boolean(TEST_USER.email && TEST_USER.password);

async function login(page: Page) {
  await page.goto("/");

  // Wait for redirect to Cognito
  await page.waitForURL(/auth\.cashsouk\.com/, { timeout: 20000 });

  await page.getByRole("textbox").first().fill(TEST_USER.email);
  await page.getByRole("button", { name: /next/i }).click();

  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.getByRole("textbox", { name: /password/i }).fill(TEST_USER.password);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/localhost:3002/, { timeout: 30000 });
}

function mockInvestorDashboardApis(page: Page, opts: { orgId: string; orgType: "PERSONAL" | "COMPANY" }) {
  const emptyPortfolio = {
    success: true,
    correlationId: "e2e",
    data: {
      portfolioTotal: 0,
      totalInvestment: 0,
      confirmedInvestment: 0,
      reservedInvestment: 0,
      availableBalance: 0,
      investmentCount: 0,
      ytdChangePercent: null,
      returnsEarned: 0,
      netAnnualReturnPercent: null,
      returnsSince: null,
      idleDays: null,
      atRisk: { amount: 0, percent: 0, count: 0, maxDaysPastDue: null },
      cashflowNext90Days: { totalAmount: 0, noteCount: 0, months: [], upcoming: [] },
    },
  };

  page.route(`${API_URL}/v1/investor/portfolio**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(emptyPortfolio),
    });
  });

  page.route(`${API_URL}/v1/investor/portfolio/history**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        correlationId: "e2e",
        data: { points: [], granularity: "1W", generatedAt: new Date().toISOString() },
      }),
    });
  });

  page.route(`${API_URL}/v1/investor/investments**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, correlationId: "e2e", data: { notes: [] } }),
    });
  });

  page.route(`${API_URL}/v1/marketplace/notes**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        correlationId: "e2e",
        data: { notes: [], pagination: { totalCount: 0, totalPages: 1 } },
      }),
    });
  });

  // OrganizationProvider
  page.route(`${API_URL}/v1/organizations/investor`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        correlationId: "e2e",
        data: {
          hasPersonalOrganization: opts.orgType === "PERSONAL",
          organizations: [
            {
              id: opts.orgId,
              type: opts.orgType,
              onboardingStatus: "COMPLETED",
              tncAccepted: true,
              depositReceived: true,
              submittedAt: new Date().toISOString(),
              people: [],
              firstName: "Test",
              lastName: "Investor",
              name: "Test Company",
            },
          ],
        },
      }),
    });
  });
}

function mockInvestorProfileCompleteness(page: Page, opts: {
  orgId: string;
  orgType: "PERSONAL" | "COMPANY";
  complete: boolean;
}) {
  const missingItem =
    opts.orgType === "COMPANY"
      ? { step: "identity", field: "name", label: "Company name" }
      : { step: "identity", field: "gender", label: "Gender" };

  page.route(`${API_URL}/v1/organizations/investor/${opts.orgId}/profile-completeness**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        correlationId: "e2e",
        data: {
          portal: "investor",
          organizationType: opts.orgType,
          complete: opts.complete,
          percent: opts.complete ? 100 : 40,
          steps: [],
          missing: [],
          userComplete: opts.complete,
          userPercent: opts.complete ? 100 : 40,
          userMissing: opts.complete ? [] : [missingItem],
        },
      }),
    });
  });
}

test.describe("Investor profile-completeness banner placement", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasAuthCredentials, "Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run banner e2e tests");

    await mockInvestorDashboardApis(page, { orgId: "org_incomplete_personal", orgType: "PERSONAL" });
    mockInvestorProfileCompleteness(page, {
      orgId: "org_incomplete_personal",
      orgType: "PERSONAL",
      complete: false,
    });
    await login(page);
  });

  test("incomplete personal investor: banner visible once and placed above the main content", async ({
    page,
  }) => {
    await page.goto("/");

    const banner = page.getByText("Complete your profile").first();
    await expect(banner).toBeVisible();

    // CTA href must remain unchanged.
    await expect(page.getByRole("link", { name: /Complete profile/i })).toHaveAttribute(
      "href",
      "/profile?focus=completeness"
    );

    await expect(page.getByText("Complete your profile")).toHaveCount(1);

    const mainHeading = page.getByRole("heading", { name: /Fund your wallet to start investing/i });
    await expect(mainHeading).toBeVisible();

    const bannerBox = await banner.boundingBox();
    const mainBox = await mainHeading.boundingBox();

    expect(bannerBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    expect(bannerBox!.y).toBeLessThan(mainBox!.y);
  });

  test("complete investor: banner hidden", async ({ page }) => {
    // Re-mock profile completeness to "complete" and force a reload
    // so React Query re-fetches using the new stub.
    await page.unroute(
      `${API_URL}/v1/organizations/investor/org_incomplete_personal/profile-completeness**`
    );
    await page.route(
      `${API_URL}/v1/organizations/investor/org_incomplete_personal/profile-completeness**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            correlationId: "e2e",
            data: {
              portal: "investor",
              organizationType: "PERSONAL",
              complete: true,
              percent: 100,
              steps: [],
              missing: [],
              userComplete: true,
              userPercent: 100,
              userMissing: [],
            },
          }),
        });
      }
    );

    await page.reload();
    await expect(page.getByText("Complete your profile")).toHaveCount(0);
  });

  test("incomplete corporate investor: banner visible and placed above the main content", async ({ page }) => {
    // Re-mock organizations + profile completeness to switch to a company org.
    await page.unroute(`${API_URL}/v1/organizations/investor`);
    await mockInvestorDashboardApis(page, { orgId: "org_incomplete_company", orgType: "COMPANY" });
    mockInvestorProfileCompleteness(page, {
      orgId: "org_incomplete_company",
      orgType: "COMPANY",
      complete: false,
    });

    await page.reload();

    const banner = page.getByText("Complete your profile").first();
    await expect(banner).toBeVisible();
    await expect(page.getByText("Complete your profile")).toHaveCount(1);
    await expect(page.getByRole("link", { name: /Complete profile/i })).toHaveAttribute(
      "href",
      "/profile?focus=completeness"
    );

    // Investor dashboard "new" view marker (used as a stable ordering anchor).
    const portfolioMarker = page.getByRole("heading", {
      name: /Fund your wallet to start investing/i,
    });
    await expect(portfolioMarker).toBeVisible();

    const bannerBox = await banner.boundingBox();
    const mainBox = await portfolioMarker.boundingBox();

    expect(bannerBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    expect(bannerBox!.y).toBeLessThan(mainBox!.y);
  });
});

