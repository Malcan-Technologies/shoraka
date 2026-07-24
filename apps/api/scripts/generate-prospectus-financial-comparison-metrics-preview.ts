/**
 * Dev-only: write Page 2 Stage 4B financial comparison metrics plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:financial-comparison-metrics-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusFinancialComparisonMetricsDocument } from "../src/modules/notes/prospectus/render-prospectus-financial-comparison-metrics";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    "prospectus-financial-comparison-metrics-preview.html"
  );
  writeFileSync(outPath, buildProspectusFinancialComparisonMetricsDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Financial Comparison Metrics preview to ${outPath}`);
}

main();
