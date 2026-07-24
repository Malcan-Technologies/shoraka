/**
 * Dev-only: write Historical Note Table plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:historical-note-table-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusHistoricalNoteTableDocument } from "../src/modules/notes/prospectus/render-prospectus-historical-note-table";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-historical-note-table-preview.html");
  writeFileSync(outPath, buildProspectusHistoricalNoteTableDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Historical Note Table preview to ${outPath}`);
}

main();
