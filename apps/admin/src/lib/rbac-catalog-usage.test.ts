import * as fs from "fs";
import * as path from "path";
import { ADMIN_PERMISSIONS } from "@cashsouk/types";

const SRC_ROOT = path.join(__dirname, "..");

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      files.push(...listSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const PERMISSION_CHECK = /\b(?:can|canAny)\(([^)]*)\)|permission="([^"]+)"/g;
const PERMISSION_LITERAL = /"([a-z_]+(?:\.[a-z_]+)+)"/g;

describe("admin permission checks reference the catalog", () => {
  it("only checks permission keys that exist in ADMIN_PERMISSIONS", () => {
    const known = new Set<string>(ADMIN_PERMISSIONS);
    const unknown: string[] = [];

    for (const file of listSourceFiles(SRC_ROOT)) {
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(PERMISSION_CHECK)) {
        const literals = match[2]
          ? [match[2]]
          : Array.from((match[1] ?? "").matchAll(PERMISSION_LITERAL), (m) => m[1]);
        for (const literal of literals) {
          if (!known.has(literal)) {
            unknown.push(`${path.relative(SRC_ROOT, file)}: ${literal}`);
          }
        }
      }
    }

    expect(unknown).toEqual([]);
  });
});
