import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "repository.ts"), "utf8");

describe("PRODUCT_UPDATED previous-configuration evidence", () => {
  it("keeps the previous product row as an inactive version instead of snapshotting it on PRODUCT_UPDATED", () => {
    expect(src).toMatch(/data: \{ status: "INACTIVE" as any \}/);
    expect(src).toMatch(/replaced_product_id: id/);
    expect(src).toMatch(/eventType: "PRODUCT_UPDATED"/);
    expect(src).not.toMatch(/previousValues/);
  });

  it("soft-deletes products so previous versions remain after later archive/delete", () => {
    const deleteFn = src.slice(src.indexOf("async delete("), src.indexOf("async setInactive("));
    expect(deleteFn).toMatch(/status: "DELETED" as any/);
    expect(deleteFn).toMatch(/deleted_at: new Date\(\)/);
    expect(deleteFn).not.toMatch(/tx\.product\.delete\(/);
  });

  it("hard-deletes only failed-create rollback, not admin archive", () => {
    expect(src).toMatch(/hardDeleteForFailedCreate/);
    expect(src).toMatch(/Do NOT use for admin-initiated delete/);
  });
});
