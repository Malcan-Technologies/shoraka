import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should display hero and trust sections", async ({ page }) => {
    await page.goto("http://localhost:3000");

    await expect(
      page.getByRole("heading", { name: /Invest smartly or Get Funded/i })
    ).toBeVisible();

    await expect(
      page.getByText(/CashSouk connects investors with real business opportunities/i)
    ).toBeVisible();

    await expect(page.locator("main").getByRole("link", { name: /Start investing/i })).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: /Apply for financing/i })).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /How peer-to-peer financing works/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Finance your invoices with ease/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Financing and investing that meets you where you are/i,
      })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Invest in verified secured loans/i })
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /Latest blog posts/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Frequently asked questions/i })
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /Start Your Investment Journey Today/i })
    ).toBeVisible();
    await expect(page.getByPlaceholder("Enter your email")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Subscribe" })).toHaveCount(0);
    await expect(
      page.getByText(/Level 19, Wisma Mont Kiara/i)
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "enquiry@cashsouk.com" })).toBeVisible();
    await expect(page.getByRole("link", { name: "03-2708 8100" })).toBeVisible();
    await expect(page.getByText("Shoraka Global Resources Sdn. Bhd.").first()).toBeVisible();
    await expect(
      page.getByText(
        new RegExp(
          `Copyright © ${new Date().getFullYear()} Shoraka Global Resources Sdn\\. Bhd\\. \\(Registration No\\. 201501030089 \\(1155412-V\\)\\)\\. All Rights Reserved\\.`
        )
      )
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "GitHub" })).toHaveCount(0);
    await expect(page.getByLabel("Social links")).toHaveCount(0);
  });
});
