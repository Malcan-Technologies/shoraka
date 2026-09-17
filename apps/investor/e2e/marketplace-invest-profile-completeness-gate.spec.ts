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

function mockInvestorOrganizationProviderApis(
  page: Page,
  opts: {
    orgId: string;
    orgType: "PERSONAL" | "COMPANY";
    people?: unknown[];
    depositReceived?: boolean;
    onboardingStatus?: "COMPLETED" | "IN_PROGRESS";
  }
) {
  page.route(`${API_URL}/v1/organizations/investor**`, async (route) => {
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
              onboardingStatus: opts.onboardingStatus ?? "COMPLETED",
              tncAccepted: true,
              depositReceived: opts.depositReceived ?? true,
              submittedAt: new Date().toISOString(),
              people: opts.people ?? [],
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

function mockInvestorPortfolioApis(page: Page) {
  page.route(`${API_URL}/v1/investor/portfolio**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        correlationId: "e2e",
        data: {
          portfolioTotal: 0,
          totalInvestment: 0,
          confirmedInvestment: 0,
          reservedInvestment: 0,
          availableBalance: 100000,
          investmentCount: 0,
          ytdChangePercent: null,
          returnsEarned: 0,
          netAnnualReturnPercent: null,
          returnsSince: null,
          idleDays: null,
          atRisk: { amount: 0, percent: 0, count: 0, maxDaysPastDue: null },
          cashflowNext90Days: { totalAmount: 0, noteCount: 0, months: [], upcoming: [] },
        },
      }),
    });
  });
}

function mockMarketplaceNotesApis(page: Page) {
  // Note fields are mirrored from unit-test `NoteListItem` fixtures so
  // `toMarketplaceNote()` can reliably map them.
  const note = {
    id: "note_1",
    noteReference: "NOTE-20260819-ABC",
    title: "Invoice note",
    productCategory: null,
    productName: "Invoice financing",
    issuerIndustry: "Manufacturing",
    sourceApplicationId: "app_1",
    sourceApplicationDisplayReference: null,
    sourceContractId: null,
    sourceContractDisplayReference: null,
    sourceInvoiceId: "inv_1",
    sourceInvoiceDisplayReference: null,
    issuerOrganizationId: "org_issuer_1",
    issuerOrganizationDisplayReference: null,
    purposeOfFinancing: "Working capital for a new contract",
    contractTitle: "Mining Rig Repair 12654",
    issuerName: "Acme Sdn Bhd",
    paymasterName: "Paymaster Co",
    riskRating: "SME-3",
    status: "FUNDING",
    listingStatus: "PUBLISHED",
    fundingStatus: "OPEN",
    servicingStatus: "NOT_STARTED",
    investorCount: 3,
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
    maturityDate: null,
    listingClosesAt: null,
    activatedAt: null,
    publishedAt: "2026-08-01",
    fundingClosedAt: null,
    repaidAt: null,
    settlementSummary: null,
    createdAt: "2026-07-15",
    updatedAt: "2026-08-10",
    requestedAmount: 100000,
    invoiceAmount: 120000,
    settlementAmount: 100000,
    targetAmount: 100000,
    fundedAmount: 40000,
    fundingPercent: 40,
    minimumFundingPercent: 80,
    profitRatePercent: 14.5,
    platformFeeRatePercent: 1,
    serviceFeeRatePercent: 0,
    tenorDays: null,
    repaidAmount: null,
    paidAmount: null,
  };

  page.route(`${API_URL}/v1/marketplace/notes**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        correlationId: "e2e",
        data: {
          notes: [note],
          pagination: { totalCount: 1, totalPages: 1 },
        },
      }),
    });
  });
}

function mockInvestorProfileCompletenessApis(
  page: Page,
  opts: {
    orgId: string;
    orgType: "PERSONAL" | "COMPANY";
    complete: boolean;
    missingStep?: "identity";
    missingCount?: number;
  }
) {
  const missingCount = opts.missingCount ?? (opts.complete ? 0 : 1);
  const missingItemBase =
    opts.orgType === "COMPANY"
      ? { step: "identity", field: "name", label: "Company name" }
      : { step: "identity", field: "gender", label: "Gender" };

  const userMissing = opts.complete
    ? []
    : Array.from({ length: missingCount }, (_, i) => ({
        ...missingItemBase,
        label: `${missingItemBase.label} ${i + 1}`,
      }));

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
          userMissing,
        },
      }),
    });
  });
}

function mockProfilePageApis(page: Page, opts: { orgId: string; orgType: "PERSONAL" | "COMPANY"; complete: boolean }) {
  // `/profile` uses:
  // - `/v1/organizations/investor/:id`
  // - `/v1/organizations/investor/:id/profile-completeness`
  // - `/v1/legal-documents/account?audience=INVESTOR`
  // - optional invitations endpoint
  page.route(`${API_URL}/v1/organizations/investor/${opts.orgId}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        correlationId: "e2e",
        data: {
          id: opts.orgId,
          type: opts.orgType,
          firstName: "Test",
          lastName: "Investor",
          middleName: null,
          nationality: null,
          country: null,
          idIssuingCountry: null,
          gender: opts.orgType === "PERSONAL" ? "MALE" : null,
          dateOfBirth: null,
          documentType: null,
          documentNumber: null,
          scInvestorCategory: null,
          dateOfIncorporation: null,
          countryOfIncorporation: null,
          residentialAddress: null,
          phoneNumber: null,
          address: null,
          bankAccountDetails: null,
          onboardingStatus: "COMPLETED",
          onboardedAt: new Date().toISOString(),
          isSophisticatedInvestor: null,
          corporateOnboardingData: {},
          corporateEntities: { directors: [], shareholders: [], corporateShareholders: [] },
          people: [],
          directorShareholderListSource: null,
          ctosDirectorShareholderWarning: null,
        },
      }),
    });
  });

  page.route(`${API_URL}/v1/legal-documents/account**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        correlationId: "e2e",
        data: { documents: [] },
      }),
    });
  });

  page.route(`${API_URL}/v1/organizations/investor/${opts.orgId}/invitations**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        correlationId: "e2e",
        data: { invitations: [] },
      }),
    });
  });

  // Also stub completeness on the profile page itself.
  mockInvestorProfileCompletenessApis(page, {
    orgId: opts.orgId,
    orgType: opts.orgType,
    complete: opts.complete,
  });
}

test.describe("Investor marketplace: profile completeness gate", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasAuthCredentials, "Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run marketplace e2e tests");

    // Default API mocks; individual tests override completeness and commit outcome.
    mockInvestorOrganizationProviderApis(page, { orgId: "org_gate_personal", orgType: "PERSONAL" });
    mockInvestorPortfolioApis(page);
    mockMarketplaceNotesApis(page);

    // Completeness + profile endpoints (default: incomplete)
    mockInvestorProfileCompletenessApis(page, {
      orgId: "org_gate_personal",
      orgType: "PERSONAL",
      complete: false,
      missingCount: 1,
    });

    mockProfilePageApis(page, { orgId: "org_gate_personal", orgType: "PERSONAL", complete: false });

    await login(page);

    await page.goto("/marketplace");
  });

  test("incomplete Personal investor → Invest blocked before modal/confirmation flow", async ({ page }) => {
    // Regression setup: investor is not "onboarded" (deposit not received),
    // so the UI must still run the backend profile-completeness pre-check.
    await page.unroute(`${API_URL}/v1/organizations/investor**`);
    await page.unroute(`${API_URL}/v1/organizations/investor/org_gate_personal/profile-completeness**`);

    mockInvestorOrganizationProviderApis(page, {
      orgId: "org_gate_personal",
      orgType: "PERSONAL",
      depositReceived: false,
      onboardingStatus: "COMPLETED",
    });

    // Re-stub completeness after un-routing.
    mockInvestorProfileCompletenessApis(page, {
      orgId: "org_gate_personal",
      orgType: "PERSONAL",
      complete: false,
      missingCount: 1,
    });

    await page.reload();

    const investButton = page.getByRole("button", { name: /Invest/i }).first();

    await expect(page.getByRole("link", { name: /Complete profile/i }).first()).toHaveAttribute(
      "href",
      "/profile?focus=completeness"
    );

    let createInvestmentCalled = false;
    page.route(`${API_URL}/v1/marketplace/notes/**/investments`, async (route) => {
      createInvestmentCalled = true;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          correlationId: "e2e",
          error: { code: "UNEXPECTED_CALL", message: "should not be called" },
        }),
      });
    });

    await investButton.click();

    await expect(page).toHaveURL(/\/profile\?focus=completeness/);
    await expect(page.getByRole("heading", { name: /Invest/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Review investment/i })).toHaveCount(0);
    expect(createInvestmentCalled).toBe(false);
  });

  test("incomplete Corporate investor → Invest blocked before modal/confirmation flow", async ({ page }) => {
    // Re-wire org + completeness for the corporate case.
    await page.unroute(`${API_URL}/v1/organizations/investor**`);
    await page.unroute(`${API_URL}/v1/organizations/investor/org_gate_personal/profile-completeness**`);
    await page.unroute(`${API_URL}/v1/organizations/investor/org_gate_personal**`);

    mockInvestorOrganizationProviderApis(page, {
      orgId: "org_gate_company",
      orgType: "COMPANY",
      people: [],
      depositReceived: false,
    });
    mockInvestorPortfolioApis(page);
    mockInvestorProfileCompletenessApis(page, {
      orgId: "org_gate_company",
      orgType: "COMPANY",
      complete: false,
      missingCount: 1,
    });
    mockProfilePageApis(page, { orgId: "org_gate_company", orgType: "COMPANY", complete: false });

    await page.reload();

    await expect(page.getByRole("link", { name: /Complete profile/i }).first()).toHaveAttribute(
      "href",
      "/profile?focus=completeness"
    );

    let createInvestmentCalled = false;
    page.route(`${API_URL}/v1/marketplace/notes/**/investments`, async (route) => {
      createInvestmentCalled = true;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          correlationId: "e2e",
          error: { code: "UNEXPECTED_CALL", message: "should not be called" },
        }),
      });
    });

    await page.goto("/marketplace");
    await page.getByRole("button", { name: /Invest/i }).first().click();

    await expect(page).toHaveURL(/\/profile\?focus=completeness/);
    await expect(page.getByRole("heading", { name: /Invest/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Review investment/i })).toHaveCount(0);
    expect(createInvestmentCalled).toBe(false);
  });

  test("completeness query error → Invest modal does not open", async ({ page }) => {
    await page.unroute(`${API_URL}/v1/organizations/investor**`);
    await page.unroute(`${API_URL}/v1/organizations/investor/org_gate_personal/profile-completeness**`);

    mockInvestorOrganizationProviderApis(page, {
      orgId: "org_gate_personal",
      orgType: "PERSONAL",
      depositReceived: false,
      onboardingStatus: "COMPLETED",
    });
    mockInvestorPortfolioApis(page);

    // Make the completeness query fail.
    page.route(`${API_URL}/v1/organizations/investor/org_gate_personal/profile-completeness**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          correlationId: "e2e",
          error: { code: "TEST_ERROR", message: "Completeness unavailable" },
        }),
      });
    });

    await page.reload();
    await page.goto("/marketplace");

    let createInvestmentCalled = false;
    page.route(`${API_URL}/v1/marketplace/notes/**/investments`, async (route) => {
      createInvestmentCalled = true;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          correlationId: "e2e",
          error: { code: "UNEXPECTED_CALL", message: "should not be called" },
        }),
      });
    });

    await page.getByRole("button", { name: /Invest/i }).first().click();

    await expect(page.getByRole("heading", { name: /Invest/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Review investment/i })).toHaveCount(0);
    expect(createInvestmentCalled).toBe(false);
  });

  test("undefined/no completeness data → Invest modal does not open", async ({ page }) => {
    await page.unroute(`${API_URL}/v1/organizations/investor**`);
    await page.unroute(`${API_URL}/v1/organizations/investor/org_gate_personal/profile-completeness**`);

    mockInvestorOrganizationProviderApis(page, {
      orgId: "org_gate_personal",
      orgType: "PERSONAL",
      depositReceived: false,
      onboardingStatus: "COMPLETED",
    });
    mockInvestorPortfolioApis(page);

    // Return success=true but with no `data` field.
    page.route(`${API_URL}/v1/organizations/investor/org_gate_personal/profile-completeness**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          correlationId: "e2e",
        }),
      });
    });

    await page.reload();
    await page.goto("/marketplace");

    let createInvestmentCalled = false;
    page.route(`${API_URL}/v1/marketplace/notes/**/investments`, async (route) => {
      createInvestmentCalled = true;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          correlationId: "e2e",
          error: { code: "UNEXPECTED_CALL", message: "should not be called" },
        }),
      });
    });

    await page.getByRole("button", { name: /Invest/i }).first().click();

    await expect(page.getByRole("heading", { name: /Invest/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Review investment/i })).toHaveCount(0);
    expect(createInvestmentCalled).toBe(false);
  });

  test("retry/success afterward → Invest can proceed if complete", async ({ page }) => {
    await page.unroute(`${API_URL}/v1/organizations/investor**`);
    await page.unroute(`${API_URL}/v1/organizations/investor/org_gate_personal/profile-completeness**`);

    mockInvestorOrganizationProviderApis(page, {
      orgId: "org_gate_personal",
      orgType: "PERSONAL",
      depositReceived: false,
      onboardingStatus: "COMPLETED",
    });
    mockInvestorPortfolioApis(page);

    let completenessAttempt = 0;
    page.route(`${API_URL}/v1/organizations/investor/org_gate_personal/profile-completeness**`, async (route) => {
      completenessAttempt += 1;

      if (completenessAttempt === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            correlationId: "e2e",
            error: { code: "TEST_ERROR", message: "Completeness temporarily unavailable" },
          }),
        });
        return;
      }

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
    });

    await page.reload();
    await page.goto("/marketplace");

    await page.getByRole("button", { name: /Invest/i }).first().click();
    await expect(page.getByRole("button", { name: /Review investment/i })).toBeVisible();
  });

  test("complete Investor → Invest flow opens normally", async ({ page }) => {
    await page.unroute(`${API_URL}/v1/organizations/investor/org_gate_personal/profile-completeness**`);
    mockInvestorProfileCompletenessApis(page, {
      orgId: "org_gate_personal",
      orgType: "PERSONAL",
      complete: true,
    });
    mockProfilePageApis(page, { orgId: "org_gate_personal", orgType: "PERSONAL", complete: true });

    await page.reload();

    await page.goto("/marketplace");
    await expect(page.getByRole("heading", { name: /^Marketplace$/i })).toBeVisible();

    // Banner should be hidden when complete.
    await expect(page.getByRole("link", { name: /Complete profile/i })).toHaveCount(0);

    await page.waitForResponse(
      (res) =>
        res.url().includes(`/v1/organizations/investor/org_gate_personal/profile-completeness`) && res.status() === 200
    );
    await page.getByRole("button", { name: /Invest/i }).first().click();
    await expect(page.getByRole("button", { name: /Review investment/i })).toBeVisible();
  });

  test("backend PROFILE_INCOMPLETE fallback still redirects correctly if state becomes stale", async ({ page }) => {
    // Pre-check thinks complete, but commit-time returns PROFILE_INCOMPLETE.
    await page.unroute(`${API_URL}/v1/organizations/investor/org_gate_personal/profile-completeness**`);
    mockInvestorProfileCompletenessApis(page, {
      orgId: "org_gate_personal",
      orgType: "COMPANY",
      complete: true,
    });

    // Ensure the active org is a COMPANY for deterministic focus computation.
    await page.unroute(`${API_URL}/v1/organizations/investor**`);
    mockInvestorOrganizationProviderApis(page, {
      orgId: "org_gate_company_stale",
      orgType: "COMPANY",
      people: [],
    });
    mockInvestorPortfolioApis(page);
    mockMarketplaceNotesApis(page);
    mockProfilePageApis(page, { orgId: "org_gate_company_stale", orgType: "COMPANY", complete: true });

    let createInvestmentCalled = false;
    page.route(`${API_URL}/v1/marketplace/notes/**/investments`, async (route) => {
      createInvestmentCalled = true;
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          correlationId: "e2e",
          error: {
            code: "PROFILE_INCOMPLETE",
            message: "Complete your profile before investing",
            details: {
              missing: [{ step: "identity", field: "name", label: "Company name" }],
            },
          },
        }),
      });
    });

    await page.reload();
    await page.goto("/marketplace");

    await page.waitForResponse(
      (res) =>
        res.url().includes(
          `/v1/organizations/investor/org_gate_company_stale/profile-completeness`
        ) && res.status() === 200
    );
    await page.getByRole("button", { name: /Invest/i }).first().click();
    await expect(page.getByRole("button", { name: /Review investment/i })).toBeVisible();

    await page.getByRole("button", { name: /Review investment/i }).click();
    await page.getByRole("button", { name: /Confirm investment/i }).click();

    await expect(page).toHaveURL(/\/profile\?focus=completeness/);
    expect(createInvestmentCalled).toBe(true);
  });
});

