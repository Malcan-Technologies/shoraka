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

  test("renders operations-friendly prospectus review chrome", async ({ page }) => {
    await page.goto(`/notes/${NOTE_ID}/prospectus`);

    await expect(page.getByRole("heading", { name: "Prospectus Review", exact: true })).toBeVisible();
    await expect(page.getByText("PROSPECTUS-DEMO-001").first()).toBeVisible();
    await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();

    // Global header keeps health indicator; review status stays in page content.
    await expect(page.locator("header").getByText("Draft", { exact: true })).toHaveCount(0);

    await expect(page.getByRole("button", { name: /Preview Prospectus/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Core Terms/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Investor Highlights/i })).toBeVisible();

    await expect(page.getByText(/temporary placeholder catalogue/i)).toHaveCount(0);
    await expect(page.getByText(/Highlight: paymaster/i)).toHaveCount(0);
    await expect(page.getByText(/source: draft/i)).toHaveCount(0);

    await expect(page.getByText("Note Reference")).toBeVisible();
    await expect(page.getByText("Financing Amount")).toBeVisible();
    await expect(page.getByText("Risk Rating")).toBeVisible();

    await page.getByRole("button", { name: /Investor Highlights/i }).click();
    await expect(page.getByText("Paymaster Highlight")).toBeVisible();
    await expect(page.getByText(/The available wording is currently under product review/i)).toBeVisible();

    const stepBeforePreview = await page.getByRole("heading", { name: "Investor Highlights" }).count();
    expect(stepBeforePreview).toBeGreaterThan(0);

    await page.getByRole("button", { name: /Preview Prospectus/i }).click();
    await expect(page.getByRole("heading", { name: /Prospectus Preview/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Page 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Page 2" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Page 3" })).toBeVisible();
    await expect(page.getByText(/source: draft/i)).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Investor Highlights" })).toBeVisible();
  });
});
