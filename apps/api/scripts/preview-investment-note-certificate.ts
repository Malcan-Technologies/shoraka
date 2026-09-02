/**
 * Dev-only: render a certificate snapshot to DOCX, then PDF via LibreOffice Gotenberg.
 *
 * Usage (from apps/api):
 *   pnpm preview:investment-note-certificate
 *   CERTIFICATE_NOTE_ID=<noteId> pnpm preview:investment-note-certificate
 *   CERTIFICATE_AUDIENCE=ISSUER pnpm preview:investment-note-certificate
 *
 * Writes under apps/api/tmp/ (gitignored). Not used in production.
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { convertDocxToPdf, DocxToPdfError, resolveGotenbergUrl } from "../src/lib/gotenberg/convert-docx-to-pdf";
import { sampleInvestmentNoteCertificateSnapshot } from "../src/modules/notes/investment-note-certificate/certificate-fixture";
import { renderInvestmentNoteCertificateDocx } from "../src/modules/notes/investment-note-certificate/render-certificate-docx";
import type { CertificateAudience, InvestmentNoteCertificateSnapshot } from "../src/modules/notes/investment-note-certificate/types";

const OUT_DIR = path.resolve(__dirname, "../tmp/investment-note-certificate");

function parseAudience(raw: string): CertificateAudience {
  const value = raw.trim().toUpperCase();
  if (value === "ADMIN" || value === "ISSUER" || value === "INVESTOR") return value;
  throw new Error(`CERTIFICATE_AUDIENCE must be ADMIN, ISSUER, or INVESTOR (got ${raw})`);
}

function audiencesToRender(): CertificateAudience[] {
  const specified = process.env.CERTIFICATE_AUDIENCE?.trim();
  if (specified) return [parseAudience(specified)];
  return ["ADMIN", "ISSUER", "INVESTOR"];
}

async function loadSnapshot() {
  const noteId = process.env.CERTIFICATE_NOTE_ID?.trim();
  if (!noteId) {
    return {
      snapshot: sampleInvestmentNoteCertificateSnapshot(),
      source: "fixture" as const,
      disconnect: async () => undefined,
    };
  }
  const { prisma } = await import("../src/lib/prisma");
  const { parseCertificateSnapshot } = await import(
    "../src/modules/notes/investment-note-certificate/snapshot"
  );
  const row = await prisma.noteInvestmentCertificate.findFirst({
    where: { note_id: noteId, version: "V01" },
    orderBy: { created_at: "asc" },
    select: { snapshot: true },
  });
  const parsed = parseCertificateSnapshot(row?.snapshot);
  if (!parsed) {
    await prisma.$disconnect().catch(() => undefined);
    throw new Error(`No V01 certificate snapshot found for note ${noteId}`);
  }
  return {
    snapshot: parsed,
    source: `db:${noteId}` as const,
    disconnect: () => prisma.$disconnect(),
  };
}

async function writeAudience(
  snapshot: InvestmentNoteCertificateSnapshot,
  audience: CertificateAudience
): Promise<void> {
  const investorOrganizationId =
    audience === "INVESTOR"
      ? process.env.CERTIFICATE_INVESTOR_ORG_ID?.trim() ||
        snapshot.investors[0]?.investorOrganizationId
      : null;
  const docx = renderInvestmentNoteCertificateDocx(snapshot, {
    audience,
    investorOrganizationId,
  });
  const base = `iinc-${audience.toLowerCase()}`;
  const docxPath = path.join(OUT_DIR, `${base}.docx`);
  writeFileSync(docxPath, docx);
  console.log(`Wrote DOCX: ${docxPath} (${docx.length} bytes)`);

  if (!resolveGotenbergUrl()) return;
  try {
    const pdf = await convertDocxToPdf(docx, { fileName: "investment-note-certificate.docx" });
    const pdfPath = path.join(OUT_DIR, `${base}.pdf`);
    writeFileSync(pdfPath, pdf);
    console.log(`Wrote PDF: ${pdfPath} (${pdf.length} bytes)`);
  } catch (error) {
    if (error instanceof DocxToPdfError) {
      console.error(`Gotenberg conversion skipped/failed: ${error.message}`);
      return;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const { snapshot, source, disconnect } = await loadSnapshot();
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    console.log(`Snapshot source: ${source}`);
    for (const audience of audiencesToRender()) {
      await writeAudience(snapshot, audience);
    }
    if (!resolveGotenbergUrl()) {
      console.log("GOTENBERG_URL unset — skipped PDF conversion.");
    }
  } finally {
    await disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
