/**
 * Dev-only: write Page 3 Stage 2 income statement plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:page-three-income-statement-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusPageThreeIncomeStatementDocument } from "../src/modules/notes/prospectus/render-prospectus-page-three-income-statement";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    "prospectus-page-three-income-statement-preview.html"
  );
  writeFileSync(outPath, buildProspectusPageThreeIncomeStatementDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Page 3 Stage 2 income statement preview to ${outPath}`);
}

main();
