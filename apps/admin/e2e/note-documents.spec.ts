import { test, expect } from "@playwright/test";

/**
 * Focused Admin note-detail Documents tab.
 *
 * Requires a signed-in admin session and a reachable note detail page.
 * Skips when ADMIN_E2E_ENABLED is not "true" so CI without Cognito stays green.
 */
const NOTE_ID = process.env.ADMIN_E2E_NOTE_ID || "seed_prospectus_demo_note_001";
const enabled = process.env.ADMIN_E2E_ENABLED === "true";

test.describe("Admin note documents", () => {
  test.skip(!enabled, "Set ADMIN_E2E_ENABLED=true with a signed-in admin session to run");

  test("loads Documents with unavailable rows and view/download controls", async ({ page }) => {
    await page.goto(`/notes/${NOTE_ID}?tab=documents`);

    await expect(page.getByRole("tab", { name: /Documents/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
    await expect(page.getByText("Joint and Several Guarantee")).toBeVisible();
    await expect(page.getByText("Letter of Offer")).toBeVisible();
    await expect(page.getByText("Facility Agreement Package")).toBeVisible();
    await expect(page.getByText("Deed of Assignment")).toBeVisible();
    await expect(page.getByText("Prospectus").first()).toBeVisible();
    await expect(page.getByText("Islamic Investment Note Certificate")).toBeVisible();
    await expect(page.getByText(/Shoraka \/ Tawarruq/i).first()).toBeVisible();

    const viewJsg = page.getByRole("button", { name: "View Joint and Several Guarantee" });
    const downloadJsg = page.getByRole("button", {
      name: "Download Joint and Several Guarantee",
    });
    await expect(viewJsg).toBeVisible();
    await expect(downloadJsg).toBeVisible();

    if (await viewJsg.isEnabled()) {
      await viewJsg.click();
    } else {
      await expect(viewJsg).toBeDisabled();
      await expect(downloadJsg).toBeDisabled();
    }

    const viewLo = page.getByRole("button", { name: "View Letter of Offer" });
    if (await viewLo.isEnabled()) {
      await viewLo.click();
    }
  });
});
