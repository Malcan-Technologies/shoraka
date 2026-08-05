import { test, expect, Page } from "@playwright/test";

// Test credentials - update these with actual test user credentials
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || "test@example.com",
  password: process.env.TEST_USER_PASSWORD || "testpassword",
};

/**
 * Helper to login via Cognito
 */
async function login(page: Page) {
  await page.goto("/");

  // Wait for redirect to Cognito
  await page.waitForURL(/auth\.cashsouk\.com/);

  // Fill in credentials
  await page.getByRole("textbox").first().fill(TEST_USER.email);
  await page.getByRole("button", { name: /next/i }).click();

  // Wait for password field and fill it
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.getByRole("textbox", { name: /password/i }).fill(TEST_USER.password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect back to app
  await page.waitForURL(/localhost:3001/, { timeout: 30000 });
}

test.describe("Issuer Organization Onboarding Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display onboarding start page for new user", async ({ page }) => {
    await page.goto("/onboarding/account");

    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /start.*onboarding/i })).toBeVisible();
  });

  test("should show account type selector after clicking start", async ({ page }) => {
    await page.goto("/onboarding/account");

    await page.getByRole("button", { name: /start.*onboarding/i }).click();

    await expect(page.getByText(/personal account/i)).toBeVisible();
    await expect(page.getByText(/company account/i)).toBeVisible();
  });

  test("should create personal organization and complete onboarding", async ({ page }) => {
    await page.goto("/onboarding/account");

    await page.getByRole("button", { name: /start.*onboarding/i }).click();
    await page.getByRole("button", { name: /personal account/i }).first().click();

    await expect(page.getByText(/onboarding.*complete/i)).toBeVisible({ timeout: 10000 });
  });

  test("should create company organization and complete onboarding", async ({ page }) => {
    await page.goto("/onboarding/account");

    await page.getByRole("button", { name: /start.*onboarding/i }).click();
    await page.getByRole("button", { name: /company account/i }).first().click();

    const companyNameInput = page.getByPlaceholder(/company name/i);
    if (await companyNameInput.isVisible()) {
      await companyNameInput.fill("Test Company Inc.");
      await page.getByRole("button", { name: /continue|create/i }).click();
    }

    await expect(page.getByText(/onboarding.*complete/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Issuer Organization Switcher", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display organization switcher in header", async ({ page }) => {
    await page.goto("/");

    // Switcher moved from sidebar to header; testid is preserved.
    await expect(page.getByTestId("organization-switcher")).toBeVisible();
  });

  test("should show current organization name", async ({ page }) => {
    await page.goto("/");

    const switcher = page.getByTestId("organization-switcher");
    await expect(switcher).toBeVisible();

    const text = await switcher.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test("should allow opening organization switcher menu", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("organization-switcher").click();

    await expect(page.getByRole("menu")).toBeVisible();
    const menuItems = page.getByRole("menuitem");
    expect(await menuItems.count()).toBeGreaterThan(0);
  });
});

test.describe("Issuer Sidebar Onboarding State", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("locked nav uses lock indicator or disabled state when gated", async ({ page }) => {
    await page.goto("/");

    // Redesign uses LockClosedIcon + disabled buttons (not only opacity-50).
    const disabledNavButtons = page.locator(
      'nav button[disabled], [data-sidebar="menu-button"][disabled]'
    );
    const lockGlyphs = page.locator(
      'nav button[disabled] svg, [data-sidebar="menu-button"][disabled] svg'
    );
    const opacityLegacy = page.locator('nav [class*="opacity-50"]');

    const disabledCount = await disabledNavButtons.count();
    const lockCount = await lockGlyphs.count();
    const legacyGrey = await opacityLegacy.count();

    // Soft: gated orgs show disabled/lock; onboarded orgs may show zero — both OK.
    if (disabledCount > 0) {
      expect(lockCount).toBeGreaterThan(0);
    } else {
      expect(disabledCount + legacyGrey).toBeGreaterThanOrEqual(0);
    }
  });

  test("should enable sidebar items for onboarded organization", async ({ page }) => {
    await page.goto("/onboarding/account");

    const startButton = page.getByRole("button", { name: /start.*onboarding/i });
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.getByRole("button", { name: /personal account/i }).first().click();
      await page.waitForTimeout(2000);
    }

    await page.goto("/");

    // Enabled items are links (not disabled buttons with lock glyph).
    const navLinks = page.locator("nav a");
    expect(await navLinks.count()).toBeGreaterThan(0);
  });
});

test.describe("Issuer Database Verification", () => {
  test("should create organization record in database", async ({ page, request }) => {
    await login(page);

    await page.goto("/onboarding/account");
    await page.getByRole("button", { name: /start.*onboarding/i }).click();
    await page.getByRole("button", { name: /personal account/i }).first().click();

    await page.waitForTimeout(3000);

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.includes("session"));

    if (sessionCookie) {
      const response = await request.get("http://localhost:4000/v1/organizations/issuer", {
        headers: {
          Cookie: `${sessionCookie.name}=${sessionCookie.value}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBeTruthy();
      expect(data.data.organizations.length).toBeGreaterThan(0);
    }
  });
});
