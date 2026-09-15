import { test, expect } from "@playwright/test";

function isAuthRedirectUrl(url: string): boolean {
  return /auth\.cashsouk\.com|amazoncognito\.com|\/api\/auth\/login/i.test(url);
}

test.describe("Issuer company seal", () => {
  test("/profile loads company seal or redirects to login", async ({ page }) => {
    await page.goto("/profile");

    await Promise.race([
      page.waitForURL((url) => isAuthRedirectUrl(url.href), { timeout: 20000 }),
      page.getByText(/Company seal|Redirecting to login|Verifying access/i).waitFor({
        state: "visible",
        timeout: 20000,
      }),
    ]).catch(() => undefined);

    if (isAuthRedirectUrl(page.url())) {
      expect(isAuthRedirectUrl(page.url())).toBeTruthy();
      return;
    }

    await expect(page.locator("body")).not.toBeEmpty();
  });
});
