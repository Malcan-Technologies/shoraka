import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps",
  testMatch: "**/*.spec.ts",
  fullyParallel: false, // Run tests sequentially to avoid auth conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for auth-dependent tests
  reporter: [["html"], ["list"]],
  timeout: 60000, // 60 second timeout per test
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15000,
  },
  projects: [
    {
      name: "investor-portal",
      testDir: "./apps/investor/e2e",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.INVESTOR_URL || "http://localhost:3002",
      },
    },
    {
      name: "issuer-portal",
      testDir: "./apps/issuer/e2e",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.ISSUER_URL || "http://localhost:3001",
      },
    },
    {
      name: "admin-portal",
      testDir: "./apps/admin/e2e",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.ADMIN_URL || "http://localhost:3003",
      },
    },
    {
      name: "landing-page",
      testDir: "./apps/landing/e2e",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.LANDING_URL || "http://localhost:3000",
      },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @cashsouk/investor dev",
      url: "http://localhost:3002",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "pnpm --filter @cashsouk/issuer dev",
      url: "http://localhost:3001",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "pnpm --filter @cashsouk/api dev",
      url: "http://localhost:4000/healthz",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});

