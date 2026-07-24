/**
 * Dev-only: write Page 2 Stage 8 CTA + shared header/footer plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:investment-cta-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusInvestmentCtaDocument } from "../src/modules/notes/prospectus/render-prospectus-investment-cta";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-investment-cta-preview.html");
  writeFileSync(outPath, buildProspectusInvestmentCtaDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Investment CTA preview to ${outPath}`);
}

main();
