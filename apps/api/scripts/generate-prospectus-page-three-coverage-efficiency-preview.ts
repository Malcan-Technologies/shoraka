/**
 * Dev-only: write Page 3 Stage 4 coverage/efficiency plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:page-three-coverage-efficiency-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusPageThreeCoverageEfficiencyDocument } from "../src/modules/notes/prospectus/render-prospectus-page-three-coverage-efficiency";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    "prospectus-page-three-coverage-efficiency-preview.html"
  );
  writeFileSync(outPath, buildProspectusPageThreeCoverageEfficiencyDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Page 3 Stage 4 coverage/efficiency preview to ${outPath}`);
}

main();
