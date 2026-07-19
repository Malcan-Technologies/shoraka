import { test, expect } from "@playwright/test";

/**
 * Focused admin Prospectus Review smoke.
 *
 * Requires:
 * - seeded demo Note: `pnpm seed:prospectus-review`
 * - API + admin running
 * - authenticated admin session (Cognito)
 *
 * Skips when ADMIN_E2E_ENABLED is not "true" so CI without Cognito stays green.
 */
const NOTE_ID = "seed_prospectus_demo_note_001";
const enabled = process.env.ADMIN_E2E_ENABLED === "true";

test.describe("Admin Prospectus Review (demo Note)", () => {
  test.skip(!enabled, "Set ADMIN_E2E_ENABLED=true with a signed-in admin session to run");

  test("opens Prospectus Review for the seeded demo Note", async ({ page }) => {
    await page.goto(`/notes/${NOTE_ID}/prospectus`);
    await expect(page.getByRole("heading", { name: /Prospectus Review/i })).toBeVisible();
    await expect(page.getByText(/PROSPECTUS-DEMO-001/i)).toBeVisible();
    await expect(
      page.getByText(/temporary placeholder catalogue/i)
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Save Draft/i })).toBeVisible();
  });
});
