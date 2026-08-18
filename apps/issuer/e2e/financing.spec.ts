import { test, expect } from "@playwright/test";

function isAuthRedirectUrl(url: string): boolean {
  return /auth\.cashsouk\.com|amazoncognito\.com|\/api\/auth\/login/i.test(url);
}

async function expectFinancingShellOrLogin(
  page: import("@playwright/test").Page,
  tabName?: RegExp
) {
  await Promise.race([
    page.waitForURL((url) => isAuthRedirectUrl(url.href), { timeout: 20000 }),
    page.getByRole("heading", { name: /^Financing$/i }).waitFor({ state: "visible", timeout: 20000 }),
    page.getByText(/Redirecting to login|Verifying access/i).waitFor({
      state: "visible",
      timeout: 20000,
    }),
  ]);

  if (isAuthRedirectUrl(page.url())) {
    expect(isAuthRedirectUrl(page.url())).toBeTruthy();
    return;
  }

  const authShell = page.getByText(/Redirecting to login|Verifying access/i);
  const financingHeading = page.getByRole("heading", { name: /^Financing$/i });
  await expect(authShell.or(financingHeading).first()).toBeVisible();

  if ((await financingHeading.isVisible().catch(() => false)) && tabName) {
    await expect(page.getByRole("tab", { name: tabName })).toBeVisible();
  }
}

test.describe("Issuer Financing", () => {
  test("/financing loads or redirects to login", async ({ page }) => {
    await page.goto("/financing");
    await expectFinancingShellOrLogin(page, /Facilities/i);
  });

  test("/financing?tab=invoices loads Invoices tab or login", async ({ page }) => {
    await page.goto("/financing?tab=invoices");
    await expectFinancingShellOrLogin(page, /Invoices/i);
  });

  test("/financing?tab=notes loads Notes tab or login", async ({ page }) => {
    await page.goto("/financing?tab=notes");
    await expectFinancingShellOrLogin(page, /Notes/i);
  });
});
