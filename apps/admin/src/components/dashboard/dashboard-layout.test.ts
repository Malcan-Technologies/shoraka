import { readFileSync } from "node:fs";
import { join } from "node:path";

const pageSource = readFileSync(join(__dirname, "../../app/page.tsx"), "utf8");

describe("admin dashboard layout", () => {
  it("puts the welcome and next-actions panel in a shared header card", () => {
    expect(pageSource).toContain("DashboardHeader");
    expect(pageSource).not.toContain("DashboardNextActions");
    expect(pageSource).not.toContain("QuickActionsSection");
    expect(pageSource).not.toContain("lg:grid-cols-[1fr_minmax(17.5rem,30%)]");
    expect(pageSource).not.toContain("Refresh dashboard");
    expect(pageSource).not.toContain("handleRefresh");
    expect(pageSource).toContain("BookMetricsRow");
    expect(pageSource).toContain("Pipeline from onboarding through notes");
    expect(pageSource).not.toContain("Operational efficiency and processing metrics");
  });
});

describe("dashboard header card", () => {
  const source = readFileSync(join(__dirname, "./dashboard-header.tsx"), "utf8");

  it("keeps welcome and queues in one card with a split action panel", () => {
    expect(source).toContain("welcomeBackTitle");
    expect(source).toContain("DashboardNextActions");
    expect(source).toContain("from-primary/10");
    expect(source).toContain("text-primary");
    expect(source).toContain("bg-status-action-bg");
    expect(source).toContain("lg:border-l");
    expect(source).toContain("lg:w-[min(36rem,48%)]");
    expect(source).toContain("overflow-hidden");
  });
});

describe("dashboard next-to-do panel", () => {
  const source = readFileSync(join(__dirname, "./dashboard-next-actions.tsx"), "utf8");

  it("renders the tinted queue panel without a nested card", () => {
    expect(source).toContain("Up next");
    expect(source).toContain("bg-status-action-text text-status-action-bg");
    expect(source).not.toContain("Card");
  });

  it("shows every open queue in a wrapping grid instead of a carousel", () => {
    expect(source).toContain("grid grid-cols-1");
    expect(source).toContain("min-[400px]:grid-cols-2");
    expect(source).toContain("2xl:grid-cols-3");
    expect(source).toContain("needsAttention.map");
    expect(source).not.toContain("carousel");
    expect(source).not.toContain("ChevronRightIcon");
    expect(source).not.toContain("Next queues");
  });

  it("keeps tile labels truncatable so long queue names do not overflow", () => {
    expect(source).toContain("truncate");
    expect(source).toContain("min-w-0");
  });
});
