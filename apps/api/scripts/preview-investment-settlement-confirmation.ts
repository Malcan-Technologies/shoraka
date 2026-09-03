/**
 * Dev-only: render an Investment Settlement Confirmation snapshot to HTML, then PDF via Playwright.
 *
 * Usage (from apps/api):
 *   pnpm preview:investment-settlement-confirmation
 *   SETTLEMENT_ID=<id> pnpm preview:investment-settlement-confirmation
 *   NOTE_ID=<noteId> pnpm preview:investment-settlement-confirmation
 *
 * Does not use GOTENBERG_URL. Writes under apps/api/tmp/ (gitignored). Not used in production.
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { sampleInvestmentSettlementConfirmationSnapshot } from "../src/modules/notes/investment-settlement-confirmation/confirmation-fixture";
import { buildInvestmentSettlementConfirmationHtml } from "../src/modules/notes/investment-settlement-confirmation/confirmation-html";
import { renderConfirmationHtmlToPdfBuffer } from "../src/modules/notes/investment-settlement-confirmation/render-confirmation-html-to-pdf";
import type { InvestmentSettlementConfirmationSnapshot } from "../src/modules/notes/investment-settlement-confirmation/types";

const OUT_DIR = path.resolve(__dirname, "../tmp/investment-settlement-confirmation");

async function loadSnapshot(): Promise<{
  snapshot: InvestmentSettlementConfirmationSnapshot;
  source: string;
  disconnect: () => Promise<unknown>;
}> {
  const settlementId = process.env.SETTLEMENT_ID?.trim();
  const noteId = process.env.NOTE_ID?.trim();
  if (!settlementId && !noteId) {
    return {
      snapshot: sampleInvestmentSettlementConfirmationSnapshot(),
      source: "fixture",
      disconnect: async () => undefined,
    };
  }
  const { prisma } = await import("../src/lib/prisma");
  const { parseConfirmationSnapshot } = await import(
    "../src/modules/notes/investment-settlement-confirmation/snapshot"
  );
  const row = await prisma.investmentSettlementConfirmation.findFirst({
    where: {
      version: "V01",
      ...(settlementId ? { settlement_id: settlementId } : { note_id: noteId }),
    },
    orderBy: { created_at: "asc" },
    select: { snapshot: true, settlement_id: true, note_id: true },
  });
  const parsed = parseConfirmationSnapshot(row?.snapshot);
  if (!parsed) {
    await prisma.$disconnect().catch(() => undefined);
    throw new Error(
      `No V01 Investment Settlement Confirmation snapshot found for ${
        settlementId ? `settlement ${settlementId}` : `note ${noteId}`
      }`
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
    const html = buildInvestmentSettlementConfirmationHtml(snapshot);
    const htmlPath = path.join(OUT_DIR, "investment-settlement-confirmation.html");
    writeFileSync(htmlPath, html);
    console.log(`Snapshot source: ${source}`);
    console.log(`Wrote HTML: ${htmlPath} (${html.length} bytes)`);

    const pdf = await renderConfirmationHtmlToPdfBuffer(html);
    const pdfPath = path.join(OUT_DIR, "investment-settlement-confirmation.pdf");
    writeFileSync(pdfPath, pdf);
    console.log(`Wrote PDF: ${pdfPath} (${pdf.length} bytes)`);
  } finally {
    await disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
