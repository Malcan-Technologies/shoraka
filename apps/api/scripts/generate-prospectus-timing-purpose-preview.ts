/**
 * Dev-only: write Timing & Purpose plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:timing-purpose-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusTimingPurposeDocument } from "../src/modules/notes/prospectus/render-prospectus-timing-purpose";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-timing-purpose-preview.html");
  writeFileSync(outPath, buildProspectusTimingPurposeDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Timing & Purpose preview to ${outPath}`);
}

main();
