import { test, expect } from "@playwright/test";

test.describe("Borrower Portal Home", () => {
  test("should display the home page", async ({ page }) => {
    await page.goto("http://localhost:3001");

    await expect(page.getByRole("heading", { name: /Welcome to Shoraka Borrower Portal/i })).toBeVisible();
    
    await expect(page.getByText(/Apply for loans quickly and securely/i)).toBeVisible();
  });
});

