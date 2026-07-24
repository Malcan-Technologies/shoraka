/**
 * Dev-only: write Page 2 About the Invoice / Work Performed plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:invoice-work-narrative-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusInvoiceWorkNarrativeDocument } from "../src/modules/notes/prospectus/render-prospectus-invoice-work-narrative";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-invoice-work-narrative-preview.html");
  writeFileSync(outPath, buildProspectusInvoiceWorkNarrativeDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Invoice / Work Performed preview to ${outPath}`);
}

main();
