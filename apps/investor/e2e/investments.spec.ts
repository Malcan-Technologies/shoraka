import { test, expect } from "@playwright/test";

test.describe("Investor Portfolio", () => {
  test("loads the portfolio book with investments and transactions views", async ({ page }) => {
    await page.goto("/investments");
    await expect(page.getByRole("heading", { name: /^Portfolio$/i })).toBeVisible();
    await expect(
      page.getByText(/See your positions and cash movements in one place/i)
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Investments$/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Transactions$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Deposit$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Withdraw$/i })).toBeVisible();
  });

  test("can open the investments tab from transactions", async ({ page }) => {
    await page.goto("/investments?tab=transactions");
    await expect(page.getByRole("tab", { name: /^Transactions$/i })).toHaveAttribute(
      "data-state",
      "active"
    );
    await page.getByRole("tab", { name: /^Investments$/i }).click();
    await expect(page.getByRole("tab", { name: /^Investments$/i })).toHaveAttribute(
      "data-state",
      "active"
    );
  });

  test("redirects /transactions to the portfolio cash tab", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/investments\?tab=transactions/);
    await expect(page.getByRole("heading", { name: /^Portfolio$/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Transactions$/i })).toHaveAttribute(
      "data-state",
      "active"
    );
  });

  test("preserves withdrawal-history deep links", async ({ page }) => {
    await page.goto("/transactions?type=Withdrawal");
    await expect(page).toHaveURL(/\/investments\?tab=transactions.*type=Withdrawal/);
    await expect(page.getByRole("tab", { name: /^Transactions$/i })).toHaveAttribute(
      "data-state",
      "active"
    );
  });
});

test.describe("Investor Marketplace", () => {
  test("loads the investment marketplace route", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page.getByRole("heading", { name: /^Marketplace$/i })).toBeVisible();
    await expect(
      page.getByText(/Compare published notes and commit from your available cash/i)
    ).toBeVisible();
  });
});
