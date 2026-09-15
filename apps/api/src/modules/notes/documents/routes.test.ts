import { readFileSync } from "node:fs";
import { join } from "node:path";

const controller = readFileSync(join(__dirname, "../controller.ts"), "utf8");

describe("admin note document routes", () => {
  it("scopes catalog and content to notes.view and does not take storage keys from the client", () => {
    const catalogIdx = controller.indexOf('"/:id/documents"');
    const contentIdx = controller.indexOf('"/:id/documents/:documentId"');
    expect(catalogIdx).toBeGreaterThan(0);
    expect(contentIdx).toBeGreaterThan(catalogIdx);
    expect(controller.slice(catalogIdx - 80, catalogIdx + 280)).toContain(
      'requirePermission("notes.view")'
    );
    expect(controller.slice(contentIdx - 80, contentIdx + 420)).toContain(
      'requirePermission("notes.view")'
    );
    expect(controller).not.toContain("s3Key");
    expect(controller).not.toContain("signed_s3_key");
  });
});
