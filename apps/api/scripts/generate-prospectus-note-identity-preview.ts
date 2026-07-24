/**
 * Dev-only: write Note Identity plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:note-identity-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusNoteIdentityDocument } from "../src/modules/notes/prospectus/render-prospectus-note-identity";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-note-identity-preview.html");
  writeFileSync(outPath, buildProspectusNoteIdentityDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Note Identity preview to ${outPath}`);
}

main();
