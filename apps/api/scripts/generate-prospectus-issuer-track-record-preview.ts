/**
 * Dev-only: write Issuer Track-Record Summary plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:issuer-track-record-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusIssuerTrackRecordDocument } from "../src/modules/notes/prospectus/render-prospectus-issuer-track-record";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-issuer-track-record-preview.html");
  writeFileSync(outPath, buildProspectusIssuerTrackRecordDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Issuer Track-Record Summary preview to ${outPath}`);
}

main();
