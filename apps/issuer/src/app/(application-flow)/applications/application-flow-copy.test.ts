import * as fs from "fs";
import * as path from "path";

const FLOW_ROOT = __dirname;
const ADMIN_LEFTOVERS = [
  "before approving the application",
  "Records requiring review",
  "Please contact administrator",
  "Contact your administrator",
  "contact your admin",
  "platform administrators",
  "RegTank",
];

function collectSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(full);
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) return [];
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".spec.ts")) return [];
    return [full];
  });
}

describe("issuer application workflow copy", () => {
  it("does not reuse admin approval or administrator contact wording", () => {
    const hits: string[] = [];
    for (const file of collectSourceFiles(FLOW_ROOT)) {
      const source = fs.readFileSync(file, "utf8");
      for (const phrase of ADMIN_LEFTOVERS) {
        if (source.includes(phrase)) {
          hits.push(`${path.relative(FLOW_ROOT, file)}: ${phrase}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("company details uses issuer recovery identity copy", () => {
    const source = fs.readFileSync(
      path.join(FLOW_ROOT, "steps/company-details-step.tsx"),
      "utf8"
    );
    expect(source).toContain("UNRESOLVED_IDENTITY_RECOVERY_TITLE");
    expect(source).toContain("UNRESOLVED_IDENTITY_RECOVERY_COPY");
    expect(source).toContain('href="/profile?focus=directors"');
    expect(source).toContain("Open Organisation");
    expect(source).toContain("showTechnicalIds={false}");
  });
});
