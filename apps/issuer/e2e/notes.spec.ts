import { test, expect } from "@playwright/test";

test.describe("Issuer Notes", () => {
  test("loads issuer notes route", async ({ page }) => {
    await page.goto("/notes");
    await expect(page.getByRole("heading", { name: /My Notes/i })).toBeVisible();
    await expect(page.getByText(/Track note funding/i)).toBeVisible();
  });
});

