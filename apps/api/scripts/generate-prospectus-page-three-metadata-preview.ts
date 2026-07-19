/**
 * Dev-only: write Page 3 Stage 1 metadata plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:page-three-metadata-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusPageThreeMetadataDocument } from "../src/modules/notes/prospectus/render-prospectus-page-three-metadata";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-page-three-metadata-preview.html");
  writeFileSync(outPath, buildProspectusPageThreeMetadataDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Page 3 Stage 1 metadata preview to ${outPath}`);
}

main();
