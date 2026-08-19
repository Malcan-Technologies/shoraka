import { readFileSync } from "node:fs";
import { join } from "node:path";

const pageSource = readFileSync(join(__dirname, "../../app/page.tsx"), "utf8");

describe("admin dashboard layout", () => {
  it("puts next-to-do queues beside the welcome message and keeps lower cards full width", () => {
    expect(pageSource).toContain("DashboardNextActions");
    expect(pageSource).toContain("welcomeBackTitle");
    expect(pageSource).not.toContain("QuickActionsSection");
    expect(pageSource).not.toContain("lg:grid-cols-[1fr_minmax(17.5rem,30%)]");
    expect(pageSource).not.toContain("Refresh dashboard");
    expect(pageSource).not.toContain("handleRefresh");
  });
});

describe("dashboard next-to-do pager", () => {
  const source = readFileSync(join(__dirname, "./dashboard-next-actions.tsx"), "utf8");

  it("loops forward with a single right arrow", () => {
    expect(source).toContain("Next queues");
    expect(source).toContain("ChevronRightIcon");
    expect(source).toContain("nextQueuePageIndex");
    expect(source).not.toContain("Previous queues");
    expect(source).not.toContain("ChevronLeftIcon");
  });
});
