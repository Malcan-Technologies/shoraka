/**
 * Dev-only: write Page 2 Invoice & Paymaster Information plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:invoice-paymaster-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusInvoicePaymasterDocument } from "../src/modules/notes/prospectus/render-prospectus-invoice-paymaster";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-invoice-paymaster-preview.html");
  writeFileSync(outPath, buildProspectusInvoicePaymasterDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Invoice & Paymaster Information preview to ${outPath}`);
}

main();
