import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_GROUPS,
  SUPER_ADMIN_ROLE_TEMPLATE,
} from "./rbac";

describe("admin permission catalog", () => {
  it("contains the dashboard reports and offer & acceptance permissions", () => {
    expect(ADMIN_PERMISSIONS).toContain("dashboard.reports.view");
    expect(ADMIN_PERMISSIONS).toContain("applications.offer_acceptance.manage");
  });

  it("has no duplicate permission keys", () => {
    expect(new Set(ADMIN_PERMISSIONS).size).toBe(ADMIN_PERMISSIONS.length);
  });

  it("lists every permission in exactly one role-configuration group", () => {
    const grouped = ADMIN_PERMISSION_GROUPS.flatMap((group) => group.permissions);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...ADMIN_PERMISSIONS].sort());
  });

  it("places the new permissions in their business-stage groups", () => {
    const dashboard = ADMIN_PERMISSION_GROUPS.find((group) => group.key === "dashboard");
    const applications = ADMIN_PERMISSION_GROUPS.find((group) => group.key === "applications");
    expect(dashboard?.permissions).toContain("dashboard.reports.view");
    expect(applications?.permissions).toContain("applications.offer_acceptance.manage");
  });

  it("does not describe reports.view as controlling dashboard PAR cards", () => {
    const reports = ADMIN_PERMISSION_GROUPS.find((group) => group.key === "reports");
    expect(reports?.description.toLowerCase()).not.toContain("dashboard");
  });

  it("gives the Super Admin template every permission", () => {
    expect([...SUPER_ADMIN_ROLE_TEMPLATE.permissions].sort()).toEqual(
      [...ADMIN_PERMISSIONS].sort()
    );
  });
});
