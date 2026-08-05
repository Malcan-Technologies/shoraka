import { test, expect } from "@playwright/test";

test.describe("External signing page", () => {
  test("shows not available for invalid token", async ({ page }) => {
    await page.route("**/v1/signing/external/**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: { code: "SIGNING_LINK_NOT_FOUND", message: "Signing link not found." },
            correlationId: "test",
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("http://localhost:3001/signing/external/invalid-token-value");

    await expect(page.getByText(/signing link is not available/i)).toBeVisible();
  });
});
