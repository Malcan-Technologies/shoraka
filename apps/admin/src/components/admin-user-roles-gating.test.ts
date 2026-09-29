import { readFileSync } from "fs";
import { join } from "path";

const rolesPage = readFileSync(join(__dirname, "../app/settings/roles/page.tsx"), "utf8");
const userRow = readFileSync(join(__dirname, "admin-user-table-row.tsx"), "utf8");

describe("Roles page admin-user actions require roles.manage", () => {
  it("passes the computed roles.manage flag to the admin users table", () => {
    expect(rolesPage).toContain('const canManageRoles = can("roles.manage");');
    expect(rolesPage).not.toMatch(/\n\s*canManageRoles\n/);
    expect(rolesPage.match(/canManageRoles=\{canManageRoles\}/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("disables role editing, deactivate and activate without roles.manage", () => {
    expect(userRow).toContain("disabled={!canManageRoles || status === \"INACTIVE\"}");
    expect(userRow).toContain(
      "disabled={!canManageRoles || deactivateMutation.isPending || isLastSuperAdmin}"
    );
    expect(userRow).toContain("disabled={!canManageRoles || reactivateMutation.isPending}");
  });

  it("ignores status toggles without roles.manage", () => {
    expect(userRow).toMatch(/handleToggleStatus = async \(\) => \{\s*if \(!canManageRoles\) return;/);
  });
});
