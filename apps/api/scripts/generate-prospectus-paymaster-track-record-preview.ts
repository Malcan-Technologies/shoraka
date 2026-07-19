/**
 * Dev-only: write Page 2 Paymaster Track Record plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:paymaster-track-record-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusPaymasterTrackRecordDocument } from "../src/modules/notes/prospectus/render-prospectus-paymaster-track-record";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-paymaster-track-record-preview.html");
  writeFileSync(outPath, buildProspectusPaymasterTrackRecordDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Paymaster Track Record preview to ${outPath}`);
}

main();
