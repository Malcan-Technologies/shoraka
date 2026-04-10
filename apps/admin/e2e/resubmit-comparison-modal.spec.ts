import { test, expect } from "@playwright/test";

/**
 * Full flow needs seeded data + admin auth. Set E2E_ADMIN_APPLICATION_WITH_RESUBMIT_URL to a URL like:
 * http://localhost:3003/applications/<productId>/<applicationId> (after signing in as admin).
 */
test.describe("Resubmit comparison modal", () => {
  test("opens from activity timeline View comparison", async ({ page }) => {
    const appUrl = process.env.E2E_ADMIN_APPLICATION_WITH_RESUBMIT_URL;
    test.skip(
      !appUrl,
      "Set E2E_ADMIN_APPLICATION_WITH_RESUBMIT_URL to exercise resubmit comparison end-to-end."
    );

    await page.goto(appUrl!);

    const openBtn = page.getByRole("button", { name: "View comparison" }).first();
    await expect(openBtn).toBeVisible({ timeout: 60_000 });
    await openBtn.click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Application resubmitted — compare revisions")).toBeVisible();
  });
});
