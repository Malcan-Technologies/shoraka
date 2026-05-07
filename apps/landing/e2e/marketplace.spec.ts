import { test, expect } from "@playwright/test";

test.describe("Marketplace Page", () => {
  test("should display featured section and filters", async ({ page }) => {
    await page.goto("http://localhost:3000/marketplace");

    await expect(
      page.getByRole("heading", { name: /Featured investment opportunities/i })
    ).toBeVisible();
    await expect(page.getByText("Top picks curated for you.")).toBeVisible();
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show more" })).toBeVisible();
  });
});
