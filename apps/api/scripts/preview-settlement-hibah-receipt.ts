/**
 * Dev-only: render a Settlement & Hibah Receipt snapshot to DOCX, then PDF via LibreOffice.
 *
 * Usage (from apps/api):
 *   pnpm preview:settlement-hibah-receipt
 *   SETTLEMENT_ID=<id> pnpm preview:settlement-hibah-receipt
 *   NOTE_ID=<noteId> pnpm preview:settlement-hibah-receipt
 *
 * Writes under apps/api/tmp/ (gitignored). Not used in production.
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { convertDocxToPdf, DocxToPdfError, resolveGotenbergUrl } from "../src/lib/gotenberg/convert-docx-to-pdf";
import { sampleSettlementHibahReceiptSnapshot } from "../src/modules/notes/settlement-hibah-receipt/receipt-fixture";
import { renderSettlementHibahReceiptDocx } from "../src/modules/notes/settlement-hibah-receipt/render-receipt-docx";
import type { SettlementHibahReceiptSnapshot } from "../src/modules/notes/settlement-hibah-receipt/types";

const OUT_DIR = path.resolve(__dirname, "../tmp/settlement-hibah-receipt");

async function loadSnapshot(): Promise<{
  snapshot: SettlementHibahReceiptSnapshot;
  source: string;
  disconnect: () => Promise<unknown>;
}> {
  const settlementId = process.env.SETTLEMENT_ID?.trim();
  const noteId = process.env.NOTE_ID?.trim();
  if (!settlementId && !noteId) {
    return {
      snapshot: sampleSettlementHibahReceiptSnapshot(),
      source: "fixture",
      disconnect: async () => undefined,
    };
  }
  const { prisma } = await import("../src/lib/prisma");
  const { parseHibahReceiptSnapshot } = await import(
    "../src/modules/notes/settlement-hibah-receipt/snapshot"
  );
  const row = await prisma.settlementHibahReceipt.findFirst({
    where: {
      version: "V01",
      ...(settlementId ? { settlement_id: settlementId } : { note_id: noteId }),
    },
    orderBy: { created_at: "asc" },
    select: { snapshot: true, settlement_id: true, note_id: true },
  });
  const parsed = parseHibahReceiptSnapshot(row?.snapshot);
  if (!parsed) {
    await prisma.$disconnect().catch(() => undefined);
    throw new Error(
      `No V01 Settlement & Hibah Receipt snapshot found for ${settlementId ? `settlement ${settlementId}` : `note ${noteId}`}`
    );
  }
  return {
    snapshot: parsed,
    source: `db:${row?.settlement_id ?? row?.note_id}`,
    disconnect: () => prisma.$disconnect(),
  };
}

async function main(): Promise<void> {
  const { snapshot, source, disconnect } = await loadSnapshot();
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    const docx = renderSettlementHibahReceiptDocx(snapshot);
    const docxPath = path.join(OUT_DIR, "settlement-hibah-receipt.docx");
    writeFileSync(docxPath, docx);
    console.log(`Snapshot source: ${source}`);
    console.log(`Wrote DOCX: ${docxPath} (${docx.length} bytes)`);

    if (!resolveGotenbergUrl()) {
      console.log("GOTENBERG_URL unset — skipped PDF conversion.");
      return;
    }
    try {
      const pdf = await convertDocxToPdf(docx, { fileName: "settlement-hibah-receipt.docx" });
      const pdfPath = path.join(OUT_DIR, "settlement-hibah-receipt.pdf");
      writeFileSync(pdfPath, pdf);
      console.log(`Wrote PDF: ${pdfPath} (${pdf.length} bytes)`);
    } catch (error) {
      if (error instanceof DocxToPdfError) {
        console.error(`Gotenberg conversion skipped/failed: ${error.message}`);
        return;
      }
      throw error;
    }
  } finally {
    await disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
