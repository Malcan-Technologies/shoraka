/**
 * Dev-only: write Shariah Investor Highlight plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:shariah-highlight-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusShariahHighlightDocument } from "../src/modules/notes/prospectus/render-prospectus-shariah-highlight";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-shariah-highlight-preview.html");
  writeFileSync(outPath, buildProspectusShariahHighlightDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Shariah Investor Highlight preview to ${outPath}`);
}

main();
