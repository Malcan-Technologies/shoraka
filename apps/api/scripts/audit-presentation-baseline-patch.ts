/**
 * Patches specific entries in presentation-baseline.json to the CURRENT working-tree content,
 * for files/reader-blocks that were deliberately changed by an approved copy-consistency fix.
 *
 * Unlike audit-presentation-baseline.ts (which snapshots a git ref, normally origin/main), this
 * patches only the named paths/blocks so every other file keeps proving byte-parity against
 * origin/main. Use this after an intentional, approved presentation change instead of
 * regenerating the whole baseline.
 *
 * Usage: tsx scripts/audit-presentation-baseline-patch.ts <path1> <path2> ...
 *   (paths must be entries in PRESENTATION_FILES or keys of MIXED_FILE_READERS)
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { MIXED_FILE_READERS, extractNamedBlocks } from "../src/lib/audit/presentation-surface";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const BASELINE_PATH = join(__dirname, "..", "src", "lib", "audit", "presentation-baseline.json");
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const readRepoFile = (path: string) => readFileSync(join(REPO_ROOT, path), "utf8");

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("Usage: tsx scripts/audit-presentation-baseline-patch.ts <path1> <path2> ...");
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as {
  ref: string;
  files: Record<string, string>;
  readerBlocks: Record<string, Record<string, string>>;
};

for (const path of targets) {
  if (path in baseline.files) {
    baseline.files[path] = sha(readRepoFile(path));
    console.log(`patched file: ${path}`);
    continue;
  }
  if (path in MIXED_FILE_READERS) {
    const blocks = extractNamedBlocks(readRepoFile(path), MIXED_FILE_READERS[path]);
    baseline.readerBlocks[path] = Object.fromEntries(
      Object.entries(blocks).map(([name, body]) => [name, sha(body)])
    );
    console.log(`patched reader blocks: ${path} (${Object.keys(blocks).join(", ")})`);
    continue;
  }
  console.error(`not a declared presentation file or reader-block file: ${path}`);
  process.exit(1);
}

writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(`wrote ${BASELINE_PATH}`);
