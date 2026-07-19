/**
 * Dev-only: write Page 2 SoukScore Risk Rating Scale plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:soukscore-rating-scale-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusSoukscoreRatingScaleDocument } from "../src/modules/notes/prospectus/render-prospectus-soukscore-rating-scale";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-soukscore-rating-scale-preview.html");
  writeFileSync(outPath, buildProspectusSoukscoreRatingScaleDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote SoukScore Rating Scale preview to ${outPath}`);
}

main();
