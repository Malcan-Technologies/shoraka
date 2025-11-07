import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should display the coming soon page", async ({ page }) => {
    await page.goto("http://localhost:3000");

    await expect(page.getByRole("heading", { name: /Coming Soon/i })).toBeVisible();
    
    await expect(page.getByText(/We're building something amazing/i)).toBeVisible();
    
    await expect(page.getByPlaceholder(/Enter your email/i)).toBeVisible();
    
    await expect(page.getByRole("button", { name: /Notify Me/i })).toBeVisible();
  });
});

