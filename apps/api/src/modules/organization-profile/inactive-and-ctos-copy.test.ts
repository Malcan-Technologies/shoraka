import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("Inactive and CTOS copy in party profile services", () => {
  const service = readFileSync(join(__dirname, "service.ts"), "utf8");

  it("uses CTOS wording for CTOS-only party errors", () => {
    expect(service).toContain("Add this CTOS person to the current profile before editing.");
    expect(service).toContain("Only new people from CTOS can be added to the current profile.");
    expect(service).toContain("This field cannot be updated from CTOS.");
    expect(service).not.toContain("from the latest external information");
    expect(service).not.toContain("from external information");
  });

  it("does not set MASTER_INACTIVE inside CTOS observation", () => {
    const observe = service.slice(
      service.indexOf("export async function observeExternalCtosParties"),
      service.indexOf("export async function listPartyProfiles")
    );
    expect(observe).toContain("absent_from_latest_external: true");
    expect(observe).not.toContain("MASTER_INACTIVE");
  });

  it("RegTank modules do not mark people inactive", () => {
    const roots = [
      join(__dirname, "../regtank"),
      join(__dirname, "../kyc"),
      join(__dirname, "../aml"),
    ];
    const files = roots.flatMap((root) => {
      try {
        return walk(root);
      } catch {
        return [];
      }
    });
    const hits = files.filter((path) => {
      if (!path.endsWith(".ts") && !path.endsWith(".tsx")) return false;
      const text = readFileSync(path, "utf8");
      return text.includes("MASTER_INACTIVE") || text.includes("inactivateMasterParty");
    });
    expect(hits).toEqual([]);
  });
});
