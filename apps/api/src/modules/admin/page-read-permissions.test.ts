import * as fs from "fs";
import * as path from "path";

const CONTROLLER = fs.readFileSync(path.join(__dirname, "controller.ts"), "utf8");

/** Source of a `router.get("<route>", ...)` registration up to the next route. */
function getRouteBlock(route: string): string {
  const idx = CONTROLLER.indexOf(`router.get(\n  "${route}",`);
  expect(idx).toBeGreaterThan(-1);
  const end = CONTROLLER.indexOf("\nrouter.", idx + 1);
  return CONTROLLER.slice(idx, end === -1 ? undefined : end);
}

describe("Organization detail Activity tab (page-ownership read)", () => {
  const block = () => getRouteBlock("/organizations/:portal/:id/onboarding-logs");

  it("uses organizations.view", () => {
    expect(block()).toContain('requirePermission("organizations.view")');
  });

  it("forces organizationId from the URL after parsing the query", () => {
    expect(block()).toMatch(
      /\.\.\.getOnboardingLogsQuerySchema\.parse\(req\.query\),\s*organizationId: id,/
    );
  });

  it("keeps GET /onboarding-logs on onboarding.view (not broadened)", () => {
    expect(getRouteBlock("/onboarding-logs")).toContain('requirePermission("onboarding.view")');
    expect(getRouteBlock("/onboarding-logs/export")).toContain(
      'requirePermission("onboarding.view")'
    );
  });
});
