/**
 * Diagnostic + safe repair for LegalDocumentVersion integrity.
 *
 * Finds definitions with more than one PUBLISHED version.
 * Optional --repair archives all but the highest version number.
 *
 * Usage:
 *   pnpm --filter @cashsouk/api exec tsx src/modules/legal-documents/diagnose-published-integrity.ts
 *   pnpm --filter @cashsouk/api exec tsx src/modules/legal-documents/diagnose-published-integrity.ts --repair
 *
 * Does not delete versions, acceptances, or audit logs.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const repair = process.argv.includes("--repair");

async function main() {
  const published = await prisma.legalDocumentVersion.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      legal_document_id: true,
      version: true,
      legal_document: { select: { type: true, title: true } },
    },
    orderBy: [{ legal_document_id: "asc" }, { version: "desc" }],
  });

  const byDoc = new Map<string, typeof published>();
  for (const row of published) {
    const list = byDoc.get(row.legal_document_id) ?? [];
    list.push(row);
    byDoc.set(row.legal_document_id, list);
  }

  const duplicates = [...byDoc.entries()].filter(([, rows]) => rows.length > 1);

  console.log(`Published versions total: ${published.length}`);
  console.log(`Definitions with Published: ${byDoc.size}`);
  console.log(`Definitions with >1 Published: ${duplicates.length}`);

  for (const [docId, rows] of duplicates) {
    console.log(
      `\nDUPLICATE ${docId} type=${rows[0]?.legal_document.type} keep=v${rows[0]?.version}`
    );
    for (const row of rows.slice(1)) {
      console.log(`  archive candidate id=${row.id} v${row.version}`);
      if (repair) {
        await prisma.legalDocumentVersion.update({
          where: { id: row.id },
          data: {
            status: "ARCHIVED",
            archived_at: new Date(),
            archived_by: "system-repair-one-published",
          },
        });
        console.log(`  repaired → ARCHIVED`);
      }
    }
  }

  if (duplicates.length === 0) {
    console.log("\nOK: no duplicate active Published versions.");
  } else if (!repair) {
    console.log("\nRe-run with --repair to archive older duplicate Published rows.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
