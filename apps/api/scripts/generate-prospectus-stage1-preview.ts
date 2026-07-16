/**
 * Dev-only: write Stage 1 plain HTML data preview (no design, no PDF required).
 *
 * Usage (from apps/api):
 *   pnpm prospectus:stage1-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusStage1Document } from "../src/modules/notes/prospectus/render-prospectus-stage1";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-stage1-preview.html");
  const html = buildProspectusStage1Document();
  writeFileSync(outPath, html, "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Stage 1 data preview to ${outPath}`);
}

main();
