import * as fs from "fs";
import * as path from "path";

const CONTROLLER = fs.readFileSync(path.join(__dirname, "controller.ts"), "utf8");
const PROFILE_PAGE = fs.readFileSync(
  path.join(__dirname, "../../../../admin/src/app/shoraka/profile/page.tsx"),
  "utf8"
);

describe("operator profile (Shoraka / Company) permissions", () => {
  it("does not use Platform Finance permissions", () => {
    expect(CONTROLLER).not.toContain("platform_settings");
    expect(PROFILE_PAGE).not.toContain("platform_settings");
  });

  it("guards every route with operator_profile.view at the router level", () => {
    expect(CONTROLLER).toContain('router.use(requirePermission("operator_profile.view"));');
  });

  it("guards every mutation with operator_profile.manage", () => {
    const mutations = [
      ...CONTROLLER.matchAll(/router\.(post|patch|put|delete)\(\s*"([^"]+)",\s*([^,]+),/g),
    ];
    expect(mutations.length).toBeGreaterThan(20);
    for (const [, method, route, guard] of mutations) {
      expect(`${method} ${route} ${guard.trim()}`).toBe(
        `${method} ${route} requirePermission("operator_profile.manage")`
      );
    }
  });

  it("gates the Shoraka profile page on operator_profile.view / manage", () => {
    expect(PROFILE_PAGE).toContain('permission="operator_profile.view"');
    expect(PROFILE_PAGE).toContain('can("operator_profile.manage")');
  });
});
