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

function mockIssuerDashboardMinimalApis(
  page: Page,
  opts: { orgId: string; orgType: "PERSONAL" | "COMPANY"; people?: unknown[] }
) {
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
              people: opts.people ?? [],
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
  const directorPending = [
    {
      entityType: "INDIVIDUAL",
      roles: ["DIRECTOR"],
      sharePercentage: null,
      matchKey: "dir_pending_1",
      onboarding: { status: "IN_PROGRESS" },
      screening: { status: null },
    } as any,
  ];

  const directorApproved = [
    {
      entityType: "INDIVIDUAL",
      roles: ["DIRECTOR"],
      sharePercentage: null,
      matchKey: "dir_approved_1",
      onboarding: { status: "APPROVED" },
      screening: { status: null },
    } as any,
  ];

  test("issuer company: red only (yellow hidden)", async ({ page }) => {
    test.skip(!hasAuthCredentials, "Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run banner e2e tests");

    const orgId = "org_red_only_issuer";
    mockIssuerDashboardMinimalApis(page, { orgId, orgType: "COMPANY", people: directorPending });
    mockIssuerProfileCompleteness(page, { orgId, complete: true });

    await login(page);
    await page.goto("/");

    const redBanner = page.getByTestId("director-shareholder-onboarding-banner");
    await expect(redBanner).toBeVisible();
    await expect(page.getByText("Complete your profile")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Go to People & Access/i })).toBeVisible();
  });

  test("issuer company: yellow only (red hidden)", async ({ page }) => {
    test.skip(!hasAuthCredentials, "Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run banner e2e tests");

    const orgId = "org_yellow_only_issuer";
    mockIssuerDashboardMinimalApis(page, { orgId, orgType: "COMPANY", people: directorApproved });
    mockIssuerProfileCompleteness(page, { orgId, complete: false });

    await login(page);
    await page.goto("/");

    await expect(page.getByTestId("director-shareholder-onboarding-banner")).toHaveCount(0);

    const yellowBanner = page.getByText("Complete your profile").first();
    await expect(yellowBanner).toBeVisible();
    await expect(page.getByText("Complete your profile")).toHaveCount(1);
    await expect(page.getByRole("link", { name: /Complete profile/i })).toHaveAttribute(
      "href",
      "/profile?focus=completeness"
    );
  });

  test("issuer company: red + yellow (red before yellow, no duplicates)", async ({ page }) => {
    test.skip(!hasAuthCredentials, "Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run banner e2e tests");

    const orgId = "org_both_issuer";
    mockIssuerDashboardMinimalApis(page, { orgId, orgType: "COMPANY", people: directorPending });
    mockIssuerProfileCompleteness(page, { orgId, complete: false });

    await login(page);
    await page.goto("/");

    const redBanner = page.getByTestId("director-shareholder-onboarding-banner").first();
    await expect(redBanner).toBeVisible();

    const yellowBanner = page.getByText("Complete your profile").first();
    await expect(yellowBanner).toBeVisible();
    await expect(page.getByText("Complete your profile")).toHaveCount(1);

    const redBox = await redBanner.boundingBox();
    const yellowBox = await yellowBanner.boundingBox();
    expect(redBox).not.toBeNull();
    expect(yellowBox).not.toBeNull();
    expect(redBox!.y).toBeLessThan(yellowBox!.y);

    await expect(page.getByRole("button", { name: /Go to People & Access/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Complete profile/i })).toHaveAttribute(
      "href",
      "/profile?focus=completeness"
    );
  });

  test("issuer company: neither banner hidden", async ({ page }) => {
    test.skip(!hasAuthCredentials, "Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run banner e2e tests");

    const orgId = "org_neither_issuer";
    mockIssuerDashboardMinimalApis(page, { orgId, orgType: "COMPANY", people: directorApproved });
    mockIssuerProfileCompleteness(page, { orgId, complete: true });

    await login(page);
    await page.goto("/");

    await expect(page.getByTestId("director-shareholder-onboarding-banner")).toHaveCount(0);
    await expect(page.getByText("Complete your profile")).toHaveCount(0);
  });
});

