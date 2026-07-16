/**
 * Dev-only: write Paymaster Investor Highlight plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:paymaster-highlight-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusPaymasterHighlightDocument } from "../src/modules/notes/prospectus/render-prospectus-paymaster-highlight";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-paymaster-highlight-preview.html");
  writeFileSync(outPath, buildProspectusPaymasterHighlightDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Paymaster Investor Highlight preview to ${outPath}`);
}

main();
