import { readFileSync } from "node:fs";
import { join } from "node:path";

const pageSource = readFileSync(join(__dirname, "../../app/page.tsx"), "utf8");
const headerSource = readFileSync(join(__dirname, "./dashboard-header.tsx"), "utf8");
const nextActionsSource = readFileSync(join(__dirname, "./dashboard-next-actions.tsx"), "utf8");
const bookSource = readFileSync(join(__dirname, "../book-metrics-row.tsx"), "utf8");
const moneySource = readFileSync(join(__dirname, "./money-on-platform.tsx"), "utf8");
const creditSource = readFileSync(join(__dirname, "./dashboard-credit-quality.tsx"), "utf8");
const operationsSource = readFileSync(join(__dirname, "../operations-section.tsx"), "utf8");
const platformSource = readFileSync(join(__dirname, "../platform-section.tsx"), "utf8");

describe("admin dashboard layout", () => {
  it("keeps pulse and up-next as separate sections", () => {
    expect(pageSource).toContain("DashboardHeader");
    expect(pageSource).toContain("DashboardNextActions");
    expect(headerSource).not.toContain("DashboardNextActions");
    expect(headerSource).toContain("Platform pulse");
    expect(headerSource).toContain("welcomeBackTitle");
    expect(headerSource).toContain("from-primary/10");
    expect(nextActionsSource).toContain("Up next");
    expect(nextActionsSource).toContain("Queues waiting on CashSouk, most urgent first");
  });

  it("uses the redesigned section titles and does not mount PAR gauges", () => {
    expect(pageSource).toContain("BookMetricsRow");
    expect(pageSource).toContain("MoneyOnPlatform");
    expect(pageSource).toContain("DashboardCreditQuality");
    expect(pageSource).toContain("OperationsSection");
    expect(pageSource).toContain("PlatformSection");
    expect(pageSource).not.toContain("PortfolioAtRiskRow");
    expect(pageSource).not.toContain("QuickActionsSection");
    expect(pageSource).not.toContain("Refresh dashboard");
    expect(pageSource).toContain("dashboard.finance.view");
    expect(pageSource).toContain("reports.view");
    expect(pageSource).toContain("dashboard.operations.view");
    expect(pageSource).toContain("dashboard.platform.view");
    expect(bookSource).toContain("The book");
    expect(bookSource).toContain("sparklinePolylinePoints");
    expect(moneySource).toContain("Money on the platform");
    expect(creditSource).toContain("Credit quality");
    expect(operationsSource).toContain("Lifecycle pipeline");
    expect(platformSource).toContain("Users and organisations, last 30 days");
  });
});

describe("dashboard pulse card", () => {
  it("is pulse-only with status tiles and no queue panel", () => {
    expect(headerSource).toContain("Work queued");
    expect(headerSource).toContain("Ledger");
    expect(headerSource).toContain("PAR90");
    expect(headerSource).toContain("Distressed");
    expect(headerSource).toContain("refreshes every minute");
    expect(headerSource).not.toContain("bg-status-action-bg");
    expect(headerSource).not.toContain("lg:w-[min(36rem,48%)]");
  });
});

describe("dashboard up-next section", () => {
  it("renders open queues as cards and keeps zero queues in a clear strip", () => {
    expect(nextActionsSource).toContain("needsAttention.map");
    expect(nextActionsSource).toContain("queueProgressPercent");
    expect(nextActionsSource).toContain("Clear");
    expect(nextActionsSource).toContain("clearQueues");
    expect(nextActionsSource).not.toContain("carousel");
    expect(nextActionsSource).not.toContain("ChevronRightIcon");
  });
});
