/**
 * One-off verification: prove no rerouted audit call site dropped a column.
 *
 * Compares, per audit model, the set of columns written at the reference revision's raw
 * `prisma.<model>.create({ data: { ... } })` call sites against the union of columns the current
 * tree can write for that model (writer helper columns + camelCase params passed by call sites).
 *
 * Usage: tsx scripts/audit-callsite-parity.ts <referenceTreeRoot>
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MODELS = [
  "accessLog",
  "securityLog",
  "onboardingLog",
  "applicationLog",
  "applicationReviewEvent",
  "noteEvent",
  "noteAdminAction",
  "productLog",
  "gatewayPaymentEvent",
  "notificationLog",
  "legalDocumentAuditLog",
];

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist" || entry === ".next") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith(".ts") && !full.endsWith(".test.ts")) out.push(full);
    }
  };
  walk(root);
  return out;
}

/** Collect the top-level keys of every `data: { ... }` payload for a given model. */
function writtenColumns(files: string[], model: string): Set<string> {
  const columns = new Set<string>();
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const marker = new RegExp(`\\.${model}\\.create\\(`, "g");
    for (const match of src.matchAll(marker)) {
      const slice = src.slice(match.index!, match.index! + 4000);
      const dataAt = slice.indexOf("data:");
      if (dataAt === -1) continue;
      // Walk braces to isolate the payload, then read only its depth-1 keys.
      let depth = 0;
      let start = -1;
      let end = -1;
      for (let i = dataAt; i < slice.length; i += 1) {
        if (slice[i] === "{") {
          depth += 1;
          if (depth === 1) start = i;
        } else if (slice[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (start === -1 || end === -1) continue;
      const payload = slice.slice(start + 1, end);
      let inner = 0;
      let line = "";
      for (const char of payload) {
        if (char === "{" || char === "[" || char === "(") inner += 1;
        if (char === "}" || char === "]" || char === ")") inner -= 1;
        if (char === "\n" && inner === 0) {
          const key = line.match(/^\s*([a-z_0-9]+)\s*:/);
          if (key) columns.add(key[1]);
          line = "";
        } else {
          line += char;
        }
      }
    }
  }
  return columns;
}

const snakeToCamel = (value: string) => value.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

const referenceRoot = process.argv[2];
if (!referenceRoot) throw new Error("reference tree root required");

const referenceFiles = sourceFiles(join(referenceRoot, "src"));
const currentFiles = sourceFiles(join(process.cwd(), "src"));
const currentSource = currentFiles.map((f) => readFileSync(f, "utf8")).join("\n");

let failures = 0;
for (const model of MODELS) {
  const reference = writtenColumns(referenceFiles, model);
  const current = writtenColumns(currentFiles, model);
  const missing: string[] = [];
  for (const column of reference) {
    if (current.has(column)) continue;
    // Rerouted call sites pass the same value under the writer's camelCase parameter name.
    if (new RegExp(`\\b${snakeToCamel(column)}\\s*:`).test(currentSource)) continue;
    missing.push(column);
  }
  const status = missing.length ? "LOST" : "ok";
  if (missing.length) failures += 1;
  console.log(
    `${status.padEnd(5)} ${model.padEnd(24)} reference=${reference.size} current=${current.size}` +
      (missing.length ? ` missing=${missing.join(",")}` : "")
  );
}

console.log(failures ? `\n${failures} model(s) lost columns` : "\nno columns lost");
process.exit(failures ? 1 : 0);
