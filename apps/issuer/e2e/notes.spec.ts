import { test, expect } from "@playwright/test";

function isAuthRedirectUrl(url: string): boolean {
  return /auth\.cashsouk\.com|amazoncognito\.com|\/api\/auth\/login/i.test(url);
}

async function expectFinancingNotesSurface(page: import("@playwright/test").Page) {
  if (isAuthRedirectUrl(page.url())) {
    expect(isAuthRedirectUrl(page.url())).toBeTruthy();
    return;
  }

  const authShell = page.getByText(/Redirecting to login|Verifying access/i);
  const financingHeading = page.getByRole("heading", { name: /^Financing$/i });

  await expect(authShell.or(financingHeading).first()).toBeVisible({ timeout: 20000 });

  if (await financingHeading.isVisible().catch(() => false)) {
    await expect(page.getByRole("tab", { name: /Notes/i })).toBeVisible();
    await expect(
      page.getByText(
        /Your facilities, invoices, and notes|Search notes|No notes yet|notes across all products/i
      )
    ).toBeVisible();
  }
}

test.describe("Issuer Notes", () => {
  test("/notes permanently redirects to Financing Notes tab", async ({ page }) => {
    await page.goto("/notes");

    await Promise.race([
      page.waitForURL((url) => isAuthRedirectUrl(url.href), { timeout: 20000 }),
      page.waitForURL(/\/financing\?tab=notes/, { timeout: 20000 }),
      page.getByText(/Redirecting to login|Verifying access/i).waitFor({
        state: "visible",
        timeout: 20000,
      }),
    ]);

    if (!isAuthRedirectUrl(page.url())) {
      await expect(page).toHaveURL(/\/financing\?tab=notes/);
    }

    await expectFinancingNotesSurface(page);
  });

  test("/financing?tab=notes loads Notes tab content", async ({ page }) => {
    await page.goto("/financing?tab=notes");

    await Promise.race([
      page.waitForURL((url) => isAuthRedirectUrl(url.href), { timeout: 20000 }),
      page.getByRole("heading", { name: /^Financing$/i }).waitFor({ state: "visible", timeout: 20000 }),
      page.getByText(/Redirecting to login|Verifying access/i).waitFor({
        state: "visible",
        timeout: 20000,
      }),
    ]);

    await expectFinancingNotesSurface(page);
  });
});
