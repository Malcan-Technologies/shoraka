import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Admin portal role vs catalog-role wiring", () => {
  const profilePanel = readFileSync(
    join(__dirname, "../accounts/components/user-account-profile-panel.tsx"),
    "utf8"
  );
  const usersHook = readFileSync(join(__dirname, "../hooks/use-users.ts"), "utf8");
  const adminUsersHook = readFileSync(join(__dirname, "../hooks/use-admin-users.ts"), "utf8");
  const adminUserRow = readFileSync(join(__dirname, "admin-user-table-row.tsx"), "utf8");

  it("Portal access saves through onboarding, not the retired roles endpoint", () => {
    expect(profilePanel).toMatch(/useUpdateUserOnboarding/);
    expect(profilePanel).toMatch(/updateOnboarding\.mutateAsync/);
    expect(profilePanel).not.toMatch(/useUpdateUserRoles/);
    expect(profilePanel).not.toMatch(/\/users\/.*\/roles/);
    expect(usersHook).not.toMatch(/useUpdateUserRoles/);
    expect(usersHook).not.toMatch(/updateUserRoles/);
  });

  it("Admin catalog role edits still go through updateAdminRole", () => {
    expect(adminUsersHook).toMatch(/export function useUpdateAdminRole/);
    expect(adminUsersHook).toMatch(/updateAdminRole/);
    expect(adminUserRow).toMatch(/useUpdateAdminRole/);
    expect(adminUserRow).toMatch(/roleDescription: selectedRole/);
  });
});
