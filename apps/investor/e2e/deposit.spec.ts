import { test, expect, Page } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || "",
  password: process.env.TEST_USER_PASSWORD || "",
};

const hasAuthCredentials = Boolean(TEST_USER.email && TEST_USER.password);

async function login(page: Page) {
  await page.goto("/");
  await page.waitForURL(/auth\.cashsouk\.com|localhost:3002/, { timeout: 15000 });

  if (!page.url().includes("auth.cashsouk.com")) {
    return;
  }

  await page.getByRole("textbox").first().fill(TEST_USER.email);
  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.getByRole("textbox", { name: /password/i }).fill(TEST_USER.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/localhost:3002/, { timeout: 30000 });
}

function mockPortfolioApis(page: Page) {
  const emptyPortfolio = {
    success: true,
    data: {
      portfolioTotal: 0,
      totalInvestment: 0,
      availableBalance: 0,
    },
    correlationId: "e2e",
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
        data: { points: [], granularity: "1W", generatedAt: new Date().toISOString() },
        correlationId: "e2e",
      }),
    });
  });

  page.route(`${API_URL}/v1/investor/balance/activity**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { entries: [], summary: { availableBalance: 0 }, page: 1, pageSize: 10, total: 0 },
        correlationId: "e2e",
      }),
    });
  });

  page.route(`${API_URL}/v1/investor/investments**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { notes: [] },
        correlationId: "e2e",
      }),
    });
  });
}

function mockDepositApis(page: Page, terminalStatus: "COMPLETED" | "REFUND_INITIATED") {
  let pollCount = 0;

  page.route(`${API_URL}/v1/investor/deposits`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: "dep_e2e_test",
          status: "CREATED",
          purpose: "INVESTOR_DEPOSIT",
          amount: 250,
          currency: "MYR",
          curlecOrderId: "order_e2e_test",
          curlecKeyId: "rzp_test_e2e",
          investorOrganizationId: "org_e2e_test",
          nameCheckResult: null,
          payerName: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        correlationId: "e2e",
      }),
    });
  });

  page.route(`${API_URL}/v1/investor/deposits/dep_e2e_test`, async (route) => {
    pollCount += 1;
    const status = pollCount >= 2 ? terminalStatus : "PAID";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: "dep_e2e_test",
          status,
          purpose: "INVESTOR_DEPOSIT",
          amount: 250,
          currency: "MYR",
          curlecOrderId: "order_e2e_test",
          curlecKeyId: "rzp_test_e2e",
          investorOrganizationId: "org_e2e_test",
          nameCheckResult: status === "COMPLETED" ? "PASS" : "NAME_UNAVAILABLE",
          payerName: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        correlationId: "e2e",
      }),
    });
  });
}

async function mockCurlecStandardCheckout(page: Page) {
  await page.addInitScript(() => {
    class MockRazorpay {
      constructor(private readonly options: { callback_url?: string }) {}
      open() {
        if (this.options.callback_url) {
          window.location.assign(this.options.callback_url);
        }
      }
      on() {}
    }
    window.Razorpay = MockRazorpay as unknown as typeof window.Razorpay;
  });
}

async function startDepositFromTransactions(page: Page) {
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Deposit" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.locator('input[inputmode="decimal"]').fill("250");
  await page.getByRole("button", { name: /Pay with FPX/i }).click();
}

test.describe("Investor FPX deposit", () => {
  test.skip(!hasAuthCredentials, "Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run deposit e2e");

  test.beforeEach(async ({ page }) => {
    await mockCurlecStandardCheckout(page);
    mockPortfolioApis(page);
    await login(page);
  });

  test("shows success when deposit completes", async ({ page }) => {
    mockDepositApis(page, "COMPLETED");
    await startDepositFromTransactions(page);

    await expect(page).toHaveURL(/depositReturn=dep_e2e_test/);
    await expect(page.getByText(/Confirming your payment/i)).toBeVisible();
    await expect(page.getByText(/Deposit successful/i)).toBeVisible({ timeout: 10000 });
  });

  test("shows refund in progress when deposit cannot be verified", async ({ page }) => {
    mockDepositApis(page, "REFUND_INITIATED");
    await startDepositFromTransactions(page);

    await expect(page).toHaveURL(/depositReturn=dep_e2e_test/);
    await expect(page.getByText(/Refund in progress/i)).toBeVisible({ timeout: 10000 });
  });
});
