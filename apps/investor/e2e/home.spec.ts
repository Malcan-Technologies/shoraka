import { test, expect } from "@playwright/test";

test.describe("Investor Portal Home", () => {
  test("should display the home page", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Welcome to CashSouk Investor Portal/i })).toBeVisible();
    
    await expect(page.getByText(/Browse and invest in verified loan opportunities/i)).toBeVisible();
  });
});

