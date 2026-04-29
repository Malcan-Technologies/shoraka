import { test, expect } from "@playwright/test";

test.describe("Admin Notes", () => {
  test("loads the notes registry route", async ({ page }) => {
    await page.goto("http://localhost:3002/notes");
    await expect(page.getByRole("heading", { name: /Notes/i })).toBeVisible();
    await expect(page.getByText(/Create notes from completed applications/i)).toBeVisible();
  });
});

