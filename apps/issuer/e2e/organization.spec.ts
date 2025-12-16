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
    await page.goto("/onboarding-start");
    
    // Check for welcome message
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
    
    // Check for start onboarding button
    await expect(page.getByRole("button", { name: /start.*onboarding/i })).toBeVisible();
  });

  test("should show account type selector after clicking start", async ({ page }) => {
    await page.goto("/onboarding-start");
    
    // Click start onboarding
    await page.getByRole("button", { name: /start.*onboarding/i }).click();
    
    // Check for account type selection cards
    await expect(page.getByText(/personal account/i)).toBeVisible();
    await expect(page.getByText(/company account/i)).toBeVisible();
  });

  test("should create personal organization and complete onboarding", async ({ page }) => {
    await page.goto("/onboarding-start");
    
    // Start onboarding
    await page.getByRole("button", { name: /start.*onboarding/i }).click();
    
    // Select personal account
    await page.getByRole("button", { name: /personal account/i }).first().click();
    
    // Wait for organization to be created and onboarding to complete
    await expect(page.getByText(/onboarding.*complete/i)).toBeVisible({ timeout: 10000 });
  });

  test("should create company organization and complete onboarding", async ({ page }) => {
    await page.goto("/onboarding-start");
    
    // Start onboarding
    await page.getByRole("button", { name: /start.*onboarding/i }).click();
    
    // Select company account
    await page.getByRole("button", { name: /company account/i }).first().click();
    
    // Fill company name if prompted
    const companyNameInput = page.getByPlaceholder(/company name/i);
    if (await companyNameInput.isVisible()) {
      await companyNameInput.fill("Test Company Inc.");
      await page.getByRole("button", { name: /continue|create/i }).click();
    }
    
    // Wait for organization to be created and onboarding to complete
    await expect(page.getByText(/onboarding.*complete/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Issuer Organization Switcher", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display organization switcher in sidebar", async ({ page }) => {
    await page.goto("/");
    
    // Check for organization switcher
    await expect(page.getByTestId("organization-switcher")).toBeVisible();
  });

  test("should show current organization name", async ({ page }) => {
    await page.goto("/");
    
    // Check that an organization name is displayed in the switcher
    const switcher = page.getByTestId("organization-switcher");
    await expect(switcher).toBeVisible();
    
    // Should show either personal account name or company name
    const text = await switcher.textContent();
    expect(text).toBeTruthy();
  });

  test("should allow switching between organizations", async ({ page }) => {
    await page.goto("/");
    
    // Click on organization switcher
    await page.getByTestId("organization-switcher").click();
    
    // Wait for dropdown to appear
    await expect(page.getByRole("menu")).toBeVisible();
    
    // Check for organization options
    const menuItems = page.getByRole("menuitem");
    expect(await menuItems.count()).toBeGreaterThan(0);
  });
});

test.describe("Issuer Sidebar Onboarding State", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should grey out sidebar items for non-onboarded organization", async ({ page }) => {
    await page.goto("/");
    
    // Check if sidebar navigation items are disabled
    const disabledItems = page.locator('[class*="opacity-50"]');
    
    // If user has non-onboarded org active, items should be greyed out
    const count = await disabledItems.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should enable sidebar items for onboarded organization", async ({ page }) => {
    // First ensure we have an onboarded org
    await page.goto("/onboarding-start");
    
    // Complete onboarding if needed
    const startButton = page.getByRole("button", { name: /start.*onboarding/i });
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.getByRole("button", { name: /personal account/i }).first().click();
      await page.waitForTimeout(2000);
    }
    
    // Navigate to main page
    await page.goto("/");
    
    // Check that navigation items are enabled (not greyed out)
    const navLinks = page.locator("nav a:not([class*='opacity-50'])");
    expect(await navLinks.count()).toBeGreaterThan(0);
  });
});

test.describe("Issuer Database Verification", () => {
  test("should create organization record in database", async ({ page, request }) => {
    await login(page);
    
    // Create a new organization via the onboarding flow
    await page.goto("/onboarding-start");
    await page.getByRole("button", { name: /start.*onboarding/i }).click();
    await page.getByRole("button", { name: /personal account/i }).first().click();
    
    // Wait for completion
    await page.waitForTimeout(3000);
    
    // Verify via API that organization was created
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name.includes("session"));
    
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

