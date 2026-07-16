/**
 * Dev-only: write Issuer Financial-Strength Highlight plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:issuer-fundamentals-highlight-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusIssuerFundamentalsHighlightDocument } from "../src/modules/notes/prospectus/render-prospectus-issuer-fundamentals-highlight";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-issuer-fundamentals-highlight-preview.html");
  writeFileSync(outPath, buildProspectusIssuerFundamentalsHighlightDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Issuer Financial-Strength Highlight preview to ${outPath}`);
}

main();
