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

  await page.waitForURL(/localhost:3001/, { timeout: 30000 });
}

function mockIssuerDashboardMinimalApis(page: Page, opts: { orgId: string; orgType: "PERSONAL" | "COMPANY" }) {
  // OrganizationProvider
  page.route(`${API_URL}/v1/organizations/issuer`, async (route) => {
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
              onboardingFeePaidAt: opts.orgType === "COMPANY" ? new Date().toISOString() : null,
              tncAccepted: true,
              people: [],
              firstName: "Test",
              lastName: "Issuer",
              name: "Test Company",
            },
          ],
        },
      }),
    });
  });

  // Issuer dashboard data for `/v1/issuer/dashboard`
  page.route(`${API_URL}/v1/issuer/dashboard**`, async (route) => {
    const url = route.request().url();
    if (!url.includes(`organizationId=${encodeURIComponent(opts.orgId)}`)) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        correlationId: "e2e",
        data: {
          user: { displayName: "" },
          book: {
            liveNoteCount: 0,
            availableLimit: null,
            approvedLimit: null,
          },
          contracts: [],
          invoices: [],
        },
      }),
    });
  });

  // Applications list (kept empty -> dashboard state "new")
  page.route(`${API_URL}/v1/applications**`, async (route) => {
    const url = route.request().url();
    const isGetList = route.request().method() === "GET" && url.includes(`organizationId=${encodeURIComponent(opts.orgId)}`);
    const isLikelyList = isGetList && !url.includes("/resubmit") && !url.includes("/offer") && !url.includes("/withdraw");
    if (!isLikelyList) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, correlationId: "e2e", data: [] }),
    });
  });

  // Notes list (kept empty)
  page.route(`${API_URL}/v1/issuer/notes**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, correlationId: "e2e", data: { notes: [] } }),
    });
  });
}

function mockIssuerProfileCompleteness(
  page: Page,
  opts: { orgId: string; complete: boolean }
) {
  const missingItem = {
    step: "company",
    field: "companyActivities",
    label: "Company activities",
  };

  page.route(
    `${API_URL}/v1/organizations/issuer/${opts.orgId}/profile-completeness**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          correlationId: "e2e",
          data: {
            portal: "issuer",
            organizationType: "COMPANY",
            complete: opts.complete,
            percent: opts.complete ? 100 : 35,
            steps: [],
            missing: opts.complete ? [] : [missingItem],
            // Issuer banner uses `complete` only, but keep shape consistent.
          },
        }),
      });
    }
  );
}

test.describe("Issuer profile-completeness banner placement", () => {
  test("incomplete issuer: banner visible near top and CTA href preserved", async ({ page }) => {
    test.skip(!hasAuthCredentials, "Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run banner e2e tests");

    const orgId = "org_incomplete_issuer";
    mockIssuerDashboardMinimalApis(page, { orgId, orgType: "COMPANY" });
    mockIssuerProfileCompleteness(page, { orgId, complete: false });

    await login(page);
    await page.goto("/");

    const banner = page.getByText("Complete your profile").first();
    await expect(banner).toBeVisible();

    await expect(page.getByText("Complete your profile")).toHaveCount(1);
    await expect(page.getByRole("link", { name: /Complete profile/i })).toHaveAttribute(
      "href",
      "/profile?focus=completeness"
    );

    const mainHeading = page.getByRole("heading", { name: /Turn an unpaid invoice into cash/i });
    await expect(mainHeading).toBeVisible();

    const bannerBox = await banner.boundingBox();
    const mainBox = await mainHeading.boundingBox();
    expect(bannerBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    expect(bannerBox!.y).toBeLessThan(mainBox!.y);
  });

  test("complete issuer: banner hidden", async ({ page }) => {
    test.skip(!hasAuthCredentials, "Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run banner e2e tests");

    const orgId = "org_complete_issuer";
    mockIssuerDashboardMinimalApis(page, { orgId, orgType: "COMPANY" });
    mockIssuerProfileCompleteness(page, { orgId, complete: true });

    await login(page);
    await page.goto("/");

    await expect(page.getByText("Complete your profile")).toHaveCount(0);
  });
});

