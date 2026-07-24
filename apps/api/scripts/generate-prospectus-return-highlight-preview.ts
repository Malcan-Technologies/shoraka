/**
 * Dev-only: write Return Investor Highlight plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:return-highlight-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusReturnHighlightDocument } from "../src/modules/notes/prospectus/render-prospectus-return-highlight";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-return-highlight-preview.html");
  writeFileSync(outPath, buildProspectusReturnHighlightDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Return Investor Highlight preview to ${outPath}`);
}

main();
