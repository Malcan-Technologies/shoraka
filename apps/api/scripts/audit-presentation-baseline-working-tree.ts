/**
 * Rebuilds presentation-baseline.json hashes from the current working tree
 * for every file declared in PRESENTATION_FILES / MIXED_FILE_READERS.
 *
 * Use after an intentional presentation change (new Admin readers, visibility, CSV).
 *
 *   pnpm --filter api exec tsx scripts/audit-presentation-baseline-working-tree.ts
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  MIXED_FILE_READERS,
  PRESENTATION_FILES,
  extractNamedBlocks,
} from "../src/lib/audit/presentation-surface";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const BASELINE_PATH = join(__dirname, "..", "src", "lib", "audit", "presentation-baseline.json");
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const readRepoFile = (path: string) => readFileSync(join(REPO_ROOT, path), "utf8");

const files: Record<string, string> = {};
for (const path of PRESENTATION_FILES) {
  files[path] = sha(readRepoFile(path));
}

const readerBlocks: Record<string, Record<string, string>> = {};
for (const [path, names] of Object.entries(MIXED_FILE_READERS)) {
  const blocks = extractNamedBlocks(readRepoFile(path), names);
  readerBlocks[path] = Object.fromEntries(
    Object.entries(blocks).map(([name, body]) => [name, sha(body)])
  );
}

writeFileSync(
  BASELINE_PATH,
  `${JSON.stringify({ ref: "working-tree:accountability-p0-p1", files, readerBlocks }, null, 2)}\n`
);
console.log(
  `recorded ${Object.keys(files).length} files and ` +
    `${Object.values(readerBlocks).reduce((n, b) => n + Object.keys(b).length, 0)} reader blocks`
);
