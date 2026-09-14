import { test, expect } from "@playwright/test";

test.describe("Marketplace Page", () => {
  test("should display hero, filters, and listings chrome", async ({ page }) => {
    await page.goto("http://localhost:3000/marketplace");

    await expect(
      page.getByRole("heading", { name: "Invest in verified secured loans" })
    ).toBeVisible();

    await expect(page.getByRole("radio", { name: "List" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Cards" })).toBeVisible();

    const featuredCreditLine = page.getByText("Selected by the CashSouk credit team");
    if (await featuredCreditLine.isVisible()) {
      await expect(page.getByText("Featured", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Editorial, not a recommendation.")).toHaveCount(0);
    }

    await expect(
      page
        .getByRole("heading", { name: "All open notes" })
        .or(page.getByText("No marketplace notes are available right now."))
    ).toBeVisible();
  });
});
