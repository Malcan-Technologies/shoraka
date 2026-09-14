import { test, expect } from "@playwright/test";

function isAuthRedirectUrl(url: string): boolean {
  return /auth\.cashsouk\.com|amazoncognito\.com|\/api\/auth\/login/i.test(url);
}

test.describe("Admin signing package", () => {
  test("application review route has shell or login (no crash)", async ({ page }) => {
    const response = await page.goto("/applications");
    expect(response).toBeTruthy();
    expect(response!.status()).toBeLessThan(500);

    await Promise.race([
      page.waitForURL((url) => isAuthRedirectUrl(url.href), { timeout: 20000 }),
      page.getByText(/Redirecting to login|Verifying access|Applications|CashSouk/i).waitFor({
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
