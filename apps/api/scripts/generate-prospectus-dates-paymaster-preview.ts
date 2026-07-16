/**
 * Dev-only: write Dates & Paymaster plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:dates-paymaster-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusDatesPaymasterDocument } from "../src/modules/notes/prospectus/render-prospectus-dates-paymaster";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-dates-paymaster-preview.html");
  writeFileSync(outPath, buildProspectusDatesPaymasterDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Dates & Paymaster preview to ${outPath}`);
}

main();
