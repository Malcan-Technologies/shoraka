/**
 * Dev-only: write Payment Basis & Shariah plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:payment-basis-shariah-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusPaymentBasisShariahDocument } from "../src/modules/notes/prospectus/render-prospectus-payment-basis-shariah";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-payment-basis-shariah-preview.html");
  writeFileSync(outPath, buildProspectusPaymentBasisShariahDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Payment Basis & Shariah preview to ${outPath}`);
}

main();
