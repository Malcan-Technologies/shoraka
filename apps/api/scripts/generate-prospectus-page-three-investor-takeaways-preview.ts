/**
 * Dev-only: write Page 3 Stage 6 investor takeaways plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:page-three-investor-takeaways-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusPageThreeInvestorTakeawaysDocument } from "../src/modules/notes/prospectus/render-prospectus-page-three-investor-takeaways";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    "prospectus-page-three-investor-takeaways-preview.html"
  );
  writeFileSync(outPath, buildProspectusPageThreeInvestorTakeawaysDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Page 3 Stage 6 investor takeaways preview to ${outPath}`);
}

main();
