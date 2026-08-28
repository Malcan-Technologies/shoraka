/**
 * Fresh audit/accountability recount from the live catalogue + source scan.
 * Run twice and diff the JSON. UNKNOWN must be 0.
 *
 *   pnpm --filter api exec tsx scripts/audit-recount.ts
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  EVENT_CATALOGUE,
  EVENT_LIFECYCLE,
  historicalReaderEventTypes,
  liveWriterEventTypes,
} from "../src/lib/audit/visibility-matrix";

const API_SRC = join(__dirname, "../src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") && !full.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const sources = walk(API_SRC).map((file) => readFileSync(file, "utf8")).join("\n");

const writerHits = new Set<string>();
for (const match of sources.matchAll(/eventType:\s*(?:ApplicationLogEventType\.)?["']([A-Z][A-Z0-9_]+)["']/g)) {
  writerHits.add(match[1]);
}
for (const match of sources.matchAll(/event_type:\s*["']([A-Z][A-Z0-9_]+)["']/g)) {
  writerHits.add(match[1]);
}
for (const match of sources.matchAll(/\.logEvent\([^)]*?["']([A-Z][A-Z0-9_]+)["']/g)) {
  writerHits.add(match[1]);
}
for (const match of sources.matchAll(/logNoteEvent\([^,]+,\s*["']([A-Z][A-Z0-9_]+)["']/g)) {
  writerHits.add(match[1]);
}
for (const match of sources.matchAll(/logProspectusAction\(\s*tx,\s*noteId,\s*["']([A-Z][A-Z0-9_]+)["']/g)) {
  writerHits.add(match[1]);
}

const catalogueKeys = Object.keys(EVENT_CATALOGUE);
const unknown = [...writerHits].filter((event) => !EVENT_CATALOGUE[event]).sort();

const byLifecycle: Record<string, number> = {};
const byLayer: Record<string, number> = {};
const byTable: Record<string, number> = {};
for (const entry of Object.values(EVENT_CATALOGUE)) {
  byLifecycle[entry.lifecycle] = (byLifecycle[entry.lifecycle] ?? 0) + 1;
  byLayer[entry.layer] = (byLayer[entry.layer] ?? 0) + 1;
  byTable[entry.table] = (byTable[entry.table] ?? 0) + 1;
}

const recount = {
  liveEvents: liveWriterEventTypes().length,
  historicalReaders: historicalReaderEventTypes().length,
  devOnly: catalogueKeys.filter((k) => EVENT_CATALOGUE[k].lifecycle === EVENT_LIFECYCLE.DEV_ONLY)
    .length,
  catalogueSize: catalogueKeys.length,
  writerHits: writerHits.size,
  unknown: unknown.length,
  unknownEvents: unknown,
  byLifecycle,
  byLayer,
  byTable,
};

const catalogueMd = [
  "# Live event catalogue",
  "",
  "Generated from `apps/api/src/lib/audit/visibility-matrix.ts`. Historical and DEV_ONLY rows are labelled; do not advertise them as current writers.",
  "",
  "| Event | Layer | Lifecycle | Table | User visible |",
  "| --- | --- | --- | --- | --- |",
  ...catalogueKeys
    .sort()
    .map((eventType) => {
      const entry = EVENT_CATALOGUE[eventType];
      return `| \`${eventType}\` | ${entry.layer} | ${entry.lifecycle} | ${entry.table} | ${entry.userVisible ? "yes" : "no"} |`;
    }),
  "",
].join("\n");

const cataloguePath = join(__dirname, "../../../docs/logging-event-catalogue.md");
const outPath = join(__dirname, "../src/lib/audit/audit-recount.json");
writeFileSync(cataloguePath, `${catalogueMd}\n`);
writeFileSync(outPath, `${JSON.stringify(recount, null, 2)}\n`);
console.log(JSON.stringify(recount, null, 2));
console.log(`wrote ${cataloguePath}`);
console.log(`wrote ${outPath}`);
