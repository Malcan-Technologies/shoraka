/**
 * Generates the audit preservation baseline consumed by the parity tests.
 *
 * Run it against a checkout of the reference revision to refresh the fixture:
 *   pnpm tsx scripts/audit-baseline.ts <repo-root> > src/lib/audit/preservation-baseline.json
 *
 * It is intentionally a plain source scanner rather than a runtime probe, so it can be pointed at
 * any revision (including `origin/main` extracted to a temp directory) without a database.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const AUDIT_TABLE_MODELS = [
  "accessLog",
  "securityLog",
  "onboardingLog",
  "applicationLog",
  "applicationReviewEvent",
  "legalDocumentAuditLog",
  "productLog",
  "noteEvent",
  "noteAdminAction",
  "gatewayPaymentEvent",
  "notificationLog",
] as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.(test|spec)\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

function schemaTables(schemaPath: string): string[] {
  const schema = readFileSync(schemaPath, "utf8");
  return [...schema.matchAll(/@@map\("([a-z_0-9]+)"\)/g)].map((m) => m[1]).sort();
}

/**
 * Application log / note event / review event types are plain strings at the write site. Collecting
 * the enum members plus every quoted event string that reaches a known audit writer gives a stable
 * over-approximation: what matters is that the set never GROWS silently.
 */
function eventTypes(files: string[]): Record<string, string[]> {
  const applicationLog = new Set<string>();
  const noteEvent = new Set<string>();
  const legalDocument = new Set<string>();
  const productLog = new Set<string>();
  const accountLog = new Set<string>();

  for (const file of files) {
    const src = readFileSync(file, "utf8");

    if (file.includes("applications/logs/types.ts")) {
      for (const m of src.matchAll(/^\s{2}([A-Z0-9_]+)\s*=\s*"([A-Z0-9_]+)",?$/gm)) {
        applicationLog.add(m[2]);
      }
    }

    // Event types written as a bare string literal. Members reached through the
    // `ApplicationLogEventType` enum are excluded here — they are already covered by the enum scan
    // above, and counting them twice would make a literal→enum refactor look like a lost event.
    for (const m of src.matchAll(/event_?[Tt]ype:\s*"([A-Z0-9_]+)"/g)) {
      if (file.includes("/notes/")) noteEvent.add(m[1]);
      else accountLog.add(m[1]);
    }
    for (const m of src.matchAll(/logEvent\(\s*\w+,\s*[\w.]+,\s*"([A-Z0-9_]+)"/g)) {
      noteEvent.add(m[1]);
    }
    if (file.includes("legal-documents/schemas.ts")) {
      for (const m of src.matchAll(/"(LEGAL_[A-Z0-9_]+)"/g)) legalDocument.add(m[1]);
    }
    for (const m of src.matchAll(/"(PRODUCT_[A-Z0-9_]+)"/g)) productLog.add(m[1]);
  }

  return {
    applicationLog: [...applicationLog].sort(),
    noteEvent: [...noteEvent].sort(),
    legalDocument: [...legalDocument].sort(),
    productLog: [...productLog].sort(),
    accountLog: [...accountLog].sort(),
  };
}

/** Files that perform a raw `prisma|tx.<auditModel>.create` call. */
function rawWriterSites(files: string[], root: string): string[] {
  const sites: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const model of AUDIT_TABLE_MODELS) {
      if (new RegExp(`\\.${model}\\.create\\b`).test(src)) {
        sites.push(`${relative(root, file)}::${model}`);
      }
    }
  }
  return sites.sort();
}

function main() {
  const root = process.argv[2] ?? process.cwd();
  const apiSrc = join(root, "apps/api/src");
  const files = walk(apiSrc);

  const baseline = {
    tables: schemaTables(join(root, "apps/api/prisma/schema.prisma")),
    eventTypes: eventTypes(files),
    rawWriterSites: rawWriterSites(files, root),
  };

  process.stdout.write(`${JSON.stringify(baseline, null, 2)}\n`);
}

main();
