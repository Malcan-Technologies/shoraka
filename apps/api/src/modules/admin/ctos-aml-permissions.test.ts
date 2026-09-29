import * as fs from "fs";
import * as path from "path";

const CONTROLLER = fs.readFileSync(path.join(__dirname, "controller.ts"), "utf8");

/** Permission passed to requirePermission for a `router.<method>("<route>", ...)` registration. */
function permissionFor(method: "get" | "post", route: string): string | null {
  const needle = `router.${method}(\n  "${route}",\n  requirePermission("`;
  const idx = CONTROLLER.indexOf(needle);
  if (idx === -1) return null;
  const start = idx + needle.length;
  return CONTROLLER.slice(start, CONTROLLER.indexOf('")', start));
}

describe("CTOS / AML permission follows the reviewed section or entity", () => {
  it("application organization CTOS (Financial tab) uses applications.financial.manage", () => {
    expect(permissionFor("post", "/applications/:id/ctos-reports")).toBe(
      "applications.financial.manage"
    );
  });

  it("application director / shareholder / guarantor CTOS uses applications.business_guarantor.manage", () => {
    expect(permissionFor("post", "/applications/:id/ctos-subject-reports")).toBe(
      "applications.business_guarantor.manage"
    );
  });

  it("guarantor Start AML uses applications.business_guarantor.manage", () => {
    expect(
      permissionFor("post", "/applications/:applicationId/guarantors/:clientGuarantorId/start-aml")
    ).toBe("applications.business_guarantor.manage");
  });

  it("application CTOS reads stay on applications.view", () => {
    expect(permissionFor("get", "/applications/:id/ctos-reports")).toBe("applications.view");
    expect(permissionFor("get", "/applications/:id/ctos-subject-reports")).toBe("applications.view");
  });

  it("organization CTOS stays on organizations.manage / organizations.view", () => {
    expect(permissionFor("post", "/organizations/:portal/:id/ctos-reports")).toBe(
      "organizations.manage"
    );
    expect(permissionFor("post", "/organizations/:portal/:id/ctos-subject-reports")).toBe(
      "organizations.manage"
    );
    expect(permissionFor("get", "/organizations/:portal/:id/ctos-reports")).toBe(
      "organizations.view"
    );
  });

  it("onboarding CTOS / AML keeps onboarding.manage / onboarding.view", () => {
    expect(permissionFor("post", "/onboarding-applications/:id/ctos-reports")).toBe(
      "onboarding.manage"
    );
    expect(permissionFor("post", "/onboarding-applications/:id/approve-aml")).toBe(
      "onboarding.manage"
    );
    expect(permissionFor("post", "/onboarding-applications/:id/refresh-aml-status")).toBe(
      "onboarding.manage"
    );
    expect(permissionFor("get", "/onboarding-applications/:id/ctos-reports")).toBe(
      "onboarding.view"
    );
  });
});
