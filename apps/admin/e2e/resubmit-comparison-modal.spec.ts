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

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("What changed in this application")).toBeVisible();

    // Same tab list as the live review page: Facility / Customer / Invoice / Acceptance are
    // merged into one Offer & acceptance tab.
    const tabs = dialog.getByRole("tab");
    await expect(tabs.first()).toBeVisible();
    await expect(dialog.getByRole("tab", { name: /Offer & acceptance/ })).toHaveCount(1);
    for (const retired of ["Facility", "Customer", "Invoice", "Acceptance"]) {
      await expect(dialog.getByRole("tab", { name: new RegExp(`^${retired}\\b`) })).toHaveCount(0);
    }
  });
});
