import { test, expect } from "@playwright/test";

test.describe("Admin Dashboard Home", () => {
  test("should display the home page", async ({ page }) => {
    await page.goto("http://localhost:3002");

    await expect(page.getByRole("heading", { name: /CashSouk Admin Dashboard/i })).toBeVisible();
    
    await expect(page.getByText(/Manage loans, users, and platform operations/i)).toBeVisible();
  });
});

