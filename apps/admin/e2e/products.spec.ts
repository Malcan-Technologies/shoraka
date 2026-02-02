import { test, expect } from "@playwright/test";

test.describe("Admin Settings Products", () => {
  test("should display the products page with heading and search", async ({ page }) => {
    await page.goto("/settings/products");

    await expect(page.getByRole("heading", { name: /Products/i }).first()).toBeVisible();

    await expect(page.getByPlaceholder(/Search by name/i)).toBeVisible();

    await expect(page.getByRole("button", { name: /Reload/i })).toBeVisible();
  });
});
