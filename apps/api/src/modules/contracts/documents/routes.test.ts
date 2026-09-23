import { readFileSync } from "node:fs";
import { join } from "node:path";

const controller = readFileSync(join(__dirname, "../../admin/controller.ts"), "utf8");

describe("admin facility document routes", () => {
  it("scopes catalog and content to contracts.view and does not take storage keys from the client", () => {
    const catalogIdx = controller.indexOf('"/contracts/:id/documents"');
    const contentIdx = controller.indexOf('"/contracts/:id/documents/:documentId"');
    expect(catalogIdx).toBeGreaterThan(0);
    expect(contentIdx).toBeGreaterThan(catalogIdx);
    expect(controller.slice(catalogIdx - 80, catalogIdx + 280)).toContain(
      'requirePermission("contracts.view")'
    );
    expect(controller.slice(contentIdx - 80, contentIdx + 420)).toContain(
      'requirePermission("contracts.view")'
    );
    expect(controller.slice(catalogIdx, contentIdx + 800)).not.toContain("s3Key");
    expect(controller.slice(catalogIdx, contentIdx + 800)).not.toContain("signed_s3_key");
  });
});
