/**
 * Dev-only: write Main Financial Terms plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:main-financial-terms-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusMainFinancialTermsDocument } from "../src/modules/notes/prospectus/render-prospectus-main-financial-terms";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-main-financial-terms-preview.html");
  writeFileSync(outPath, buildProspectusMainFinancialTermsDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Main Financial Terms preview to ${outPath}`);
}

main();
