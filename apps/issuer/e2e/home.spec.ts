import { test, expect } from "@playwright/test";

function isAuthRedirectUrl(url: string): boolean {
  return /auth\.cashsouk\.com|amazoncognito\.com|\/api\/auth\/login/i.test(url);
}

test.describe("Issuer Portal Home", () => {
  test("home requires auth or shows dashboard shell", async ({ page }) => {
    await page.goto("/");

    // Unauthenticated users are redirected to login; authenticated users see the dashboard.
    await Promise.race([
      page.waitForURL((url) => isAuthRedirectUrl(url.href), { timeout: 20000 }),
      page.getByRole("heading", { name: /^Dashboard$/i }).waitFor({ state: "visible", timeout: 20000 }),
      page.getByText(/Redirecting to login|Verifying access/i).waitFor({ state: "visible", timeout: 20000 }),
    ]);

    if (isAuthRedirectUrl(page.url())) {
      expect(isAuthRedirectUrl(page.url())).toBeTruthy();
      return;
    }

    const redirectedToLogin = page.getByText(/Redirecting to login|Verifying access/i);
    const dashboardHeading = page.getByRole("heading", { name: /^Dashboard$/i });

    await expect(redirectedToLogin.or(dashboardHeading).first()).toBeVisible();

    if (await dashboardHeading.isVisible().catch(() => false)) {
      await expect(
        page.getByText(
          /Welcome back|Complete onboarding to unlock financing applications|Manage your financing from here/i
        )
      ).toBeVisible();
    }
  });
});
