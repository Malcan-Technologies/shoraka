/**
 * Generates the presentation parity fixture consumed by presentation-parity.test.ts.
 *
 * The audit standardization is writer-side only, so every file that reads, formats, gates
 * visibility of, or exports audit data must stay byte-identical to the reference revision. This
 * records a hash per file so the test proves that without needing a git ref at test time.
 *
 * Usage: tsx scripts/audit-presentation-baseline.ts <ref>
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  PRESENTATION_FILES,
  MIXED_FILE_READERS,
  extractNamedBlocks,
} from "../src/lib/audit/presentation-surface";

const ref = process.argv[2] ?? "origin/main";
const REPO_ROOT = join(__dirname, "..", "..", "..");

function showAtRef(path: string): string | null {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

const files: Record<string, string> = {};
const missing: string[] = [];
for (const path of PRESENTATION_FILES) {
  const content = showAtRef(path);
  if (content === null) {
    missing.push(path);
    continue;
  }
  files[path] = sha(content);
}

const readerBlocks: Record<string, Record<string, string>> = {};
for (const [path, blockNames] of Object.entries(MIXED_FILE_READERS)) {
  const content = showAtRef(path);
  if (content === null) {
    missing.push(path);
    continue;
  }
  const blocks = extractNamedBlocks(content, blockNames);
  readerBlocks[path] = Object.fromEntries(
    Object.entries(blocks).map(([name, body]) => [name, sha(body)])
  );
}

writeFileSync(
  join(__dirname, "..", "src", "lib", "audit", "presentation-baseline.json"),
  `${JSON.stringify({ ref, files, readerBlocks }, null, 2)}\n`
);

console.log(
  `recorded ${Object.keys(files).length} files and ` +
    `${Object.values(readerBlocks).reduce((n, b) => n + Object.keys(b).length, 0)} reader blocks`
);
if (missing.length) console.log(`absent at ${ref}:\n  ${missing.join("\n  ")}`);
