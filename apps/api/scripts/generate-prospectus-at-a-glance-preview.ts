/**
 * Dev-only: write At a Glance plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:at-a-glance-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusAtAGlanceDocument } from "../src/modules/notes/prospectus/render-prospectus-at-a-glance";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-at-a-glance-preview.html");
  writeFileSync(outPath, buildProspectusAtAGlanceDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote At a Glance preview to ${outPath}`);
}

main();
