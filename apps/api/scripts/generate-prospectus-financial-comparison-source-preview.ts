/**
 * Dev-only: write Page 2 Stage 4A financial comparison source plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:financial-comparison-source-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusFinancialComparisonSourceDocument } from "../src/modules/notes/prospectus/render-prospectus-financial-comparison-source";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    "prospectus-financial-comparison-source-preview.html"
  );
  writeFileSync(outPath, buildProspectusFinancialComparisonSourceDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Financial Comparison Source preview to ${outPath}`);
}

main();
