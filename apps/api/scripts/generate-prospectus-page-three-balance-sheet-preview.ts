/**
 * Dev-only: write Page 3 Stage 3 balance sheet plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:page-three-balance-sheet-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusPageThreeBalanceSheetDocument } from "../src/modules/notes/prospectus/render-prospectus-page-three-balance-sheet";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-page-three-balance-sheet-preview.html");
  writeFileSync(outPath, buildProspectusPageThreeBalanceSheetDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Page 3 Stage 3 balance sheet preview to ${outPath}`);
}

main();
