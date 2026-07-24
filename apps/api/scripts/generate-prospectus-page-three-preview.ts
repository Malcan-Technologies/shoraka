/**
 * Dev-only: write full Prospectus Page 3 HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:page-three-preview
 *   pnpm prospectus:page-three-preview --note-id=<NOTE_ID>
 *
 * Without --note-id, writes the deterministic sample assembly.
 * With --note-id, loads the Note via Prisma and maps Stages 1–6.
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { buildProspectusPageThreeFromNoteId } from "../src/modules/notes/prospectus/prospectus-page-three";
import { SAMPLE_PROSPECTUS_PAGE_THREE } from "../src/modules/notes/prospectus/prospectus-page-three.sample-data";
import { renderProspectusPageThreeHtml } from "../src/modules/notes/prospectus/render-prospectus-page-three";

function parseNoteId(argv: string[]): string | null {
  for (const arg of argv) {
    if (arg.startsWith("--note-id=")) {
      const value = arg.slice("--note-id=".length).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

async function main() {
  const noteId = parseNoteId(process.argv.slice(2));
  const page = noteId
    ? await buildProspectusPageThreeFromNoteId(prisma, noteId)
    : SAMPLE_PROSPECTUS_PAGE_THREE;

  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-page-three-preview.html");
  writeFileSync(outPath, renderProspectusPageThreeHtml(page), "utf8");
  // eslint-disable-next-line no-console
  console.log(
    noteId
      ? `Wrote Page 3 preview for note ${noteId} to ${outPath}`
      : `Wrote sample Page 3 preview to ${outPath}`
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
