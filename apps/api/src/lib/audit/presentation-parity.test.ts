/**
 * Proves the audit standardization is writer-side only.
 *
 * Activity titles, descriptions, remarks, expanded details, per-portal visibility and CSV/export
 * output are product behavior owned by the reference revision. This suite hashes every file on the
 * presentation surface against a fixture recorded from that revision, so a reworded title, a
 * widened visibility allowlist or a dropped CSV column fails here instead of in manual QA.
 *
 * Regenerate the fixture only when a presentation change is intended:
 *   pnpm --filter api exec tsx scripts/audit-presentation-baseline.ts origin/main
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import baseline from "./presentation-baseline.json";
import { MIXED_FILE_READERS, PRESENTATION_FILES, extractNamedBlocks } from "./presentation-surface";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const readRepoFile = (path: string) => readFileSync(join(REPO_ROOT, path), "utf8");

describe("audit presentation parity: readers, formatters, visibility, exports", () => {
  it("covers the whole declared presentation surface", () => {
    expect(Object.keys(baseline.files).sort()).toEqual([...PRESENTATION_FILES].sort());
    expect(Object.keys(baseline.readerBlocks).sort()).toEqual(
      Object.keys(MIXED_FILE_READERS).sort()
    );
  });

  it("still has every presentation file on disk", () => {
    const absent = PRESENTATION_FILES.filter((path) => !existsSync(join(REPO_ROOT, path)));
    expect(absent).toEqual([]);
  });

  for (const path of PRESENTATION_FILES) {
    it(`${path} is unchanged`, () => {
      expect(sha(readRepoFile(path))).toBe(baseline.files[path as keyof typeof baseline.files]);
    });
  }
});

describe("audit exports project columns explicitly", () => {
  /**
   * The new forensic columns are additive, and list endpoints return whole rows, so they appear as
   * extra keys on those responses. That is only safe while every export enumerates its columns: a
   * refactor to spread the row would silently publish forensic columns into customer-facing exports.
   */
  const EXPORT_SERIALIZERS = [
    "apps/api/src/modules/admin/controller.ts",
    "apps/api/src/modules/products/log/controller.ts",
    "apps/api/src/modules/legal-documents/audit-admin-controller.ts",
    "apps/api/src/modules/legal-documents/acceptance-admin-controller.ts",
  ];

  for (const path of EXPORT_SERIALIZERS) {
    it(`${path} spreads no audit row into an export payload`, () => {
      const src = readRepoFile(path);
      expect(src).not.toMatch(/\.\.\.log\b/);
      expect(src).not.toMatch(/\.\.\.row\b/);
      expect(src).not.toMatch(/\.\.\.entry\b/);
    });
  }
});

describe("audit presentation parity: readers sharing a file with a writer", () => {
  for (const [path, names] of Object.entries(MIXED_FILE_READERS)) {
    const expected = baseline.readerBlocks[path as keyof typeof baseline.readerBlocks] as Record<
      string,
      string
    >;

    it(`${path} still declares every reader block`, () => {
      const blocks = extractNamedBlocks(readRepoFile(path), names);
      expect(Object.keys(blocks).sort()).toEqual(Object.keys(expected).sort());
    });

    for (const name of names) {
      it(`${path}::${name} is unchanged`, () => {
        const blocks = extractNamedBlocks(readRepoFile(path), names);
        expect(sha(blocks[name])).toBe(expected[name]);
      });
    }
  }
});
