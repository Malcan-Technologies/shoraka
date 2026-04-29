import { test, expect } from "@playwright/test";

test.describe("Investor Marketplace", () => {
  test("loads the investment marketplace route", async ({ page }) => {
    await page.goto("/investments");
    await expect(page.getByRole("heading", { name: /Investment Marketplace/i })).toBeVisible();
    await expect(page.getByText(/Browse published notes/i)).toBeVisible();
  });
});

