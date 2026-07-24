/**
 * Dev-only: write Page 2 Credit Insights plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:credit-insights-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusCreditInsightsDocument } from "../src/modules/notes/prospectus/render-prospectus-credit-insights";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-credit-insights-preview.html");
  writeFileSync(outPath, buildProspectusCreditInsightsDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Credit Insights preview to ${outPath}`);
}

main();
