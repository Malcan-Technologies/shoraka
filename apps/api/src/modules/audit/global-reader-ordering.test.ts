import { readFileSync } from "node:fs";
import { join } from "node:path";

const srcRoot = join(__dirname, "../..");

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

describe("global audit readers use deterministic occurred_at + id ordering", () => {
  const readers = [
    "modules/auth/audit/reader.ts",
    "modules/security/audit/reader.ts",
    "modules/onboarding/audit/reader.ts",
    "modules/products/audit/reader.ts",
    "modules/legal-documents/audit/reader.ts",
    "modules/notification/audit/reader.ts",
  ];

  it.each(readers)("%s orders by occurred_at desc then id desc", (relativePath) => {
    const source = readSrc(relativePath);
    const usesSharedOrder = source.includes("AUDIT_OCCURRED_AT_ID_DESC");
    const usesInlineOrder =
      /occurred_at:\s*"desc"/.test(source) && /id:\s*"desc"/.test(source);
    expect(usesSharedOrder || usesInlineOrder).toBe(true);
  });
});
