import { test, expect } from "@playwright/test";

/**
 * Focused Admin facility-detail Documents tab.
 *
 * Requires a signed-in admin session and a reachable facility detail page.
 * Skips when ADMIN_E2E_ENABLED is not "true" so CI without Cognito stays green.
 */
const CONTRACT_ID = process.env.ADMIN_E2E_CONTRACT_ID || "seed_facility_demo_contract_001";
const enabled = process.env.ADMIN_E2E_ENABLED === "true";

test.describe("Admin facility documents", () => {
  test.skip(!enabled, "Set ADMIN_E2E_ENABLED=true with a signed-in admin session to run");

  test("loads Documents with catalog rows and view/download controls", async ({ page }) => {
    await page.goto(`/contracts/${CONTRACT_ID}?tab=documents`);

    await expect(page.getByRole("tab", { name: /Documents/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
    await expect(page.getByText("Legal documents for this facility.")).toBeVisible();
    await expect(page.getByText("Underlying contract")).toBeVisible();
    await expect(page.getByText("Letter of Offer")).toBeVisible();
    await expect(page.getByText("Facility Agreement", { exact: true })).toBeVisible();
    await expect(page.getByText("Joint and Several Guarantee")).toBeVisible();
    await expect(page.getByText("Deed of Assignment")).toBeVisible();
    await expect(page.getByText("Canonical")).toHaveCount(0);

    const viewUnderlying = page.getByRole("button", { name: "View Underlying contract" });
    const downloadUnderlying = page.getByRole("button", {
      name: "Download Underlying contract",
    });
    await expect(viewUnderlying).toBeVisible();
    await expect(downloadUnderlying).toBeVisible();

    if (await viewUnderlying.isEnabled()) {
      await viewUnderlying.click();
    } else {
      await expect(viewUnderlying).toBeDisabled();
      await expect(downloadUnderlying).toBeDisabled();
    }
  });
});
