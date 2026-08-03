import { test, expect } from "@playwright/test";

function isAuthRedirectUrl(url: string): boolean {
  return /auth\.cashsouk\.com|amazoncognito\.com|\/api\/auth\/login/i.test(url);
}

test.describe("Issuer Applications", () => {
  test("/applications loads or redirects to login", async ({ page }) => {
    await page.goto("/applications");

    await Promise.race([
      page.waitForURL((url) => isAuthRedirectUrl(url.href), { timeout: 20000 }),
      page.getByRole("heading", { name: /^Applications$/i }).waitFor({
        state: "visible",
        timeout: 20000,
      }),
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
    const applicationsHeading = page.getByRole("heading", { name: /^Applications$/i });
    await expect(authShell.or(applicationsHeading).first()).toBeVisible();

    if (await applicationsHeading.isVisible().catch(() => false)) {
      await expect(
        page.getByText(/Track financing applications|respond to offers|No applications yet/i)
      ).toBeVisible();
    }
  });

  test("/applications/[id] route has shell or login (no crash)", async ({ page }) => {
    const response = await page.goto("/applications/some-id");
    expect(response).toBeTruthy();
    expect(response!.status()).toBeLessThan(500);

    await Promise.race([
      page.waitForURL((url) => isAuthRedirectUrl(url.href), { timeout: 20000 }),
      page.getByText(/Redirecting to login|Verifying access|Loading|not found|Application/i).waitFor({
        state: "visible",
        timeout: 20000,
      }),
    ]).catch(() => undefined);

    if (isAuthRedirectUrl(page.url())) {
      expect(isAuthRedirectUrl(page.url())).toBeTruthy();
      return;
    }

    // Page rendered something (auth shell, detail, empty, or not-found) — no blank crash.
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
