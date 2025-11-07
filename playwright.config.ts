import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3002",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @shoraka/investor dev",
      url: "http://localhost:3002",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});

