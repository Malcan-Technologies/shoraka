import { readFileSync } from "node:fs";
import { join } from "node:path";

const API_SRC = join(__dirname, "..", "..");

const MATERIAL_ONBOARDING_FILES = [
  "modules/regtank/webhooks/cod-handler.ts",
  "modules/regtank/webhooks/kyc-handler.ts",
  "modules/regtank/webhooks/individual-onboarding-handler.ts",
  "modules/regtank/webhooks/org-aml-milestone.ts",
  "modules/regtank/webhooks/eod-handler.ts",
  "modules/regtank/service.ts",
  "modules/organization/service.ts",
  "modules/admin/service.ts",
  "modules/admin/organization-admin-profile.ts",
];

describe("material onboarding evidence is not skippable", () => {
  it("does not swallow onboarding log failures on material writers", () => {
    for (const relative of MATERIAL_ONBOARDING_FILES) {
      const src = readFileSync(join(API_SRC, relative), "utf8");
      expect(src).not.toMatch(/onboarding log[\s\S]{0,80}non-blocking/i);
      expect(src).not.toMatch(/Failed to write MEMBER_.*\(non-blocking\)/);
      expect(src).not.toMatch(/Failed to write organization profile audit log \(non-blocking\)/);
    }
  });

  it("writes TNC_APPROVED in the same helper as the organization flag update", () => {
    const src = readFileSync(join(API_SRC, "modules/organization/service.ts"), "utf8");
    const block = src.slice(src.indexOf("async acceptTnc"));
    expect(block).toMatch(/persistOrganizationUpdateAndOnboardingLogs/);
    expect(block).toMatch(/eventType:\s*"TNC_APPROVED"/);
  });
});
