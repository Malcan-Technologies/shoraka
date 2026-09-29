import * as fs from "fs";
import * as path from "path";
import { ADMIN_PERMISSIONS } from "@cashsouk/types";

const SRC_ROOT = path.join(__dirname, "..", "..");

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      files.push(...listSourceFiles(full));
    } else if (entry.name.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const GUARD_CALL = /\b(?:requirePermission|requireAnyPermission|userHasPermission)\(([^)]*)\)/g;
const PERMISSION_LITERAL = /"([a-z_]+(?:\.[a-z_]+)+)"/g;

describe("backend permission guards reference the catalog", () => {
  it("only uses permission keys that exist in ADMIN_PERMISSIONS", () => {
    const known = new Set<string>(ADMIN_PERMISSIONS);
    const unknown: string[] = [];

    for (const file of listSourceFiles(SRC_ROOT)) {
      const text = fs.readFileSync(file, "utf8");
      for (const call of text.matchAll(GUARD_CALL)) {
        for (const literal of call[1].matchAll(PERMISSION_LITERAL)) {
          if (!known.has(literal[1])) {
            unknown.push(`${path.relative(SRC_ROOT, file)}: ${literal[1]}`);
          }
        }
      }
    }

    expect(unknown).toEqual([]);
  });
});
