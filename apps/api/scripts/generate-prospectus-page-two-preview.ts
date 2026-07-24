/**
 * Dev-only: write full Prospectus Page 2 HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:page-two-preview
 *   pnpm prospectus:page-two-preview --note-id=<NOTE_ID>
 *
 * Without --note-id, writes the deterministic sample assembly.
 * With --note-id, loads the Note via Prisma and maps Stage 1–8.
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { buildProspectusPageTwoFromNoteId } from "../src/modules/notes/prospectus/prospectus-page-two";
import { SAMPLE_PROSPECTUS_PAGE_TWO } from "../src/modules/notes/prospectus/prospectus-page-two.sample-data";
import { renderProspectusPageTwoHtml } from "../src/modules/notes/prospectus/render-prospectus-page-two";

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
    ? await buildProspectusPageTwoFromNoteId(prisma, noteId)
    : SAMPLE_PROSPECTUS_PAGE_TWO;

  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-page-two-preview.html");
  writeFileSync(outPath, renderProspectusPageTwoHtml(page), "utf8");
  // eslint-disable-next-line no-console
  console.log(
    noteId
      ? `Wrote Page 2 preview for note ${noteId} to ${outPath}`
      : `Wrote sample Page 2 preview to ${outPath}`
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
