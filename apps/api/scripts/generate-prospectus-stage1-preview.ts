/**
 * Redirected: broad Stage 1 preview replaced by Note Identity isolation.
 *
 * Usage:
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
  console.log(
    `Stage 1 preview now writes Note Identity only → ${outPath}\nPrefer: pnpm prospectus:note-identity-preview`
  );
}

main();
