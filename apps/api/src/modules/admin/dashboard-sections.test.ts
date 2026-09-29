import type { AdminPermission } from "@cashsouk/types";
import { resolveDashboardStatsSections } from "./dashboard-sections";

const withPermissions =
  (...granted: AdminPermission[]) =>
  (permission: AdminPermission) =>
    granted.includes(permission);

describe("resolveDashboardStatsSections", () => {
  it("returns no sections for dashboard.view alone", () => {
    expect(resolveDashboardStatsSections(withPermissions("dashboard.view"))).toEqual({
      platform: false,
      operations: false,
      finance: false,
      reports: false,
    });
  });

  it.each([
    ["dashboard.platform.view", "platform"],
    ["dashboard.operations.view", "operations"],
    ["dashboard.finance.view", "finance"],
    ["dashboard.reports.view", "reports"],
  ] as const)("maps %s to the %s section only", (permission, section) => {
    const sections = resolveDashboardStatsSections(withPermissions(permission));
    expect(sections[section]).toBe(true);
    expect(Object.values(sections).filter(Boolean)).toHaveLength(1);
  });

  it("does not let reports.view or bucket_balances.view unlock dashboard sections", () => {
    expect(
      resolveDashboardStatsSections(withPermissions("reports.view", "bucket_balances.view"))
    ).toEqual({ platform: false, operations: false, finance: false, reports: false });
  });

  it("returns every section when the caller holds every permission", () => {
    expect(resolveDashboardStatsSections(() => true)).toEqual({
      platform: true,
      operations: true,
      finance: true,
      reports: true,
    });
  });
});
