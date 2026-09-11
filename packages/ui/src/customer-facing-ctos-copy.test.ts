import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

const UI_ROOT = __dirname;
const REPO_ROOT = join(__dirname, "../../..");
const CUSTOMER_APP_ROOTS = [
  join(REPO_ROOT, "apps/issuer/src"),
  join(REPO_ROOT, "apps/investor/src"),
];
const ADMIN_COPY_FILES = [
  join(REPO_ROOT, "apps/admin/src/components/admin/director-shareholder-table.tsx"),
  join(REPO_ROOT, "apps/admin/src/organizations/components/organization-people-access-detail.tsx"),
  join(REPO_ROOT, "apps/admin/src/organizations/components/organization-person-card.tsx"),
  join(REPO_ROOT, "packages/types/src/party-ctos-comparison.ts"),
  join(REPO_ROOT, "packages/types/src/application-people-display.ts"),
  join(UI_ROOT, "party-profile-detail-fields.tsx"),
  join(UI_ROOT, "party-ctos-indicator.tsx"),
];
const SHARED_ADMIN_ONLY_UI = new Set(["party-profile-detail-fields.tsx", "party-ctos-indicator.tsx"]);

function walkSourceFiles(root: string, files: string[]): void {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".next") continue;
      walkSourceFiles(path, files);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    files.push(path);
  }
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function extractQuotedStrings(source: string): string[] {
  const out: string[] = [];
  const re = /(["'`])((?:\\.|(?!\1).)*)\1/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    out.push(match[2].replace(/\\n/g, "\n"));
  }
  return out;
}

function extractJsxText(source: string): string[] {
  const out: string[] = [];
  const re = />\s*([^<>{}]+?)\s*</g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const text = match[1].replace(/\s+/g, " ").trim();
    if (text) out.push(text);
  }
  return out;
}

function isProviderEnumToken(value: string): boolean {
  return /^CTOS(_[A-Z0-9]+)*$/.test(value.trim());
}

function customerCopyHits(source: string): string[] {
  const cleaned = stripComments(source);
  return [...extractQuotedStrings(cleaned), ...extractJsxText(cleaned)].filter(
    (value) => value.includes("CTOS") && !isProviderEnumToken(value)
  );
}

function collectCustomerFiles(): string[] {
  const files: string[] = [];
  walkSourceFiles(UI_ROOT, files);
  for (const root of CUSTOMER_APP_ROOTS) walkSourceFiles(root, files);
  return files.filter((path) => !SHARED_ADMIN_ONLY_UI.has(path.split(/[/\\]/).pop() ?? ""));
}

describe("customer issuer/investor CTOS copy", () => {
  it("does not render CTOS, Latest CTOS, CTOS returned, or CTOS information", () => {
    const banned = [/Latest CTOS/, /CTOS returned/, /CTOS information/, /CTOS/];
    const hits: string[] = [];
    for (const file of collectCustomerFiles()) {
      for (const copy of customerCopyHits(readFileSync(file, "utf8"))) {
        if (banned.some((pattern) => pattern.test(copy))) {
          hits.push(`${file.replace(REPO_ROOT + "/", "")}: ${copy}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps Admin CTOS wording", () => {
    const adminSource = ADMIN_COPY_FILES.map((path) => readFileSync(path, "utf8")).join("\n");
    expect(adminSource).toContain("CTOS");
    expect(adminSource).toContain("Latest CTOS information");
    expect(adminSource).toContain("latest CTOS information");
    expect(adminSource).toContain("CTOS matched");
    expect(adminSource).toContain("CTOS differs");
    expect(adminSource).toContain("CTOS did not return usable directors or shareholders");
    expect(adminSource).toContain("resolveDirectorShareholderCtosEmptyWarning");
  });
});
