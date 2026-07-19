/**
 * Dev-only: write full Prospectus Page 1 HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:page-one-preview
 *   pnpm prospectus:page-one-preview --note-id=<NOTE_ID>
 *
 * Without --note-id, writes the deterministic sample assembly.
 * With --note-id, loads the Note via Prisma and maps Stage 1–8.
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { buildProspectusPageOneFromNoteId } from "../src/modules/notes/prospectus/prospectus-page-one";
import { SAMPLE_PROSPECTUS_PAGE_ONE } from "../src/modules/notes/prospectus/prospectus-page-one.sample-data";
import { renderProspectusPageOneHtml } from "../src/modules/notes/prospectus/render-prospectus-page-one";

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
    ? await buildProspectusPageOneFromNoteId(prisma, noteId)
    : SAMPLE_PROSPECTUS_PAGE_ONE;

  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-page-one-preview.html");
  writeFileSync(outPath, renderProspectusPageOneHtml(page), "utf8");
  // eslint-disable-next-line no-console
  console.log(
    noteId
      ? `Wrote Page 1 preview for note ${noteId} to ${outPath}`
      : `Wrote sample Page 1 preview to ${outPath}`
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
