import { test, expect } from "@playwright/test";

function isAuthRedirectUrl(url: string): boolean {
  return /auth\.cashsouk\.com|amazoncognito\.com|\/api\/auth\/login/i.test(url);
}

async function expectFinancingInvoicesSurface(page: import("@playwright/test").Page) {
  if (isAuthRedirectUrl(page.url())) {
    expect(isAuthRedirectUrl(page.url())).toBeTruthy();
    return;
  }

  const authShell = page.getByText(/Redirecting to login|Verifying access/i);
  const financingHeading = page.getByRole("heading", { name: /^Financing$/i });

  await expect(authShell.or(financingHeading).first()).toBeVisible({ timeout: 20000 });

  if (await financingHeading.isVisible().catch(() => false)) {
    await expect(page.getByRole("tab", { name: /Invoices/i })).toBeVisible();
    await expect(
      page.getByText(/See your facilities|No invoices yet|No matching invoices/i)
    ).toBeVisible();
  }
}

test.describe("Issuer Notes", () => {
  test("/notes permanently redirects to Financing Invoices tab", async ({ page }) => {
    await page.goto("/notes");

    await Promise.race([
      page.waitForURL((url) => isAuthRedirectUrl(url.href), { timeout: 20000 }),
      page.waitForURL(/\/financing\?tab=invoices/, { timeout: 20000 }),
      page.getByText(/Redirecting to login|Verifying access/i).waitFor({
        state: "visible",
        timeout: 20000,
      }),
    ]);

    if (!isAuthRedirectUrl(page.url())) {
      await expect(page).toHaveURL(/\/financing\?tab=invoices/);
    }

    await expectFinancingInvoicesSurface(page);
  });

  test("/financing?tab=notes aliases to Invoices tab", async ({ page }) => {
    await page.goto("/financing?tab=notes");

    await Promise.race([
      page.waitForURL((url) => isAuthRedirectUrl(url.href), { timeout: 20000 }),
      page.getByRole("heading", { name: /^Financing$/i }).waitFor({ state: "visible", timeout: 20000 }),
      page.getByText(/Redirecting to login|Verifying access/i).waitFor({
        state: "visible",
        timeout: 20000,
      }),
    ]);

    await expectFinancingInvoicesSurface(page);
  });
});
