/**
 * Dev-only: write Page 3 Stage 5 financial trends plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:page-three-trends-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusPageThreeTrendsDocument } from "../src/modules/notes/prospectus/render-prospectus-page-three-trends";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-page-three-trends-preview.html");
  writeFileSync(outPath, buildProspectusPageThreeTrendsDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Page 3 Stage 5 trends preview to ${outPath}`);
}

main();
