#!/usr/bin/env tsx
/**
 * Local/UAT-only helper to tweak a single frozen invoice snapshot field:
 *   note.invoice_snapshot.offer_details.risk_rating
 *
 * IMPORTANT:
 * - Blocked in production.
 * - Validates MARC SME grade input via `isMarcSmeGrade`.
 * - Updates only that nested JSON field; verifies other `invoice_snapshot`
 *   fields remain unchanged (deep compare with the field removed).
 *
 * Example:
 *   pnpm --filter @cashsouk/api tsx scripts/dev-set-note-invoice-snapshot-risk-rating.ts \
 *     --noteReference PROSPECTUS-DEMO-001 --riskRating SME-3
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import { isMarcSmeGrade, type MarcSmeGrade } from "@cashsouk/types";
import { isDeepStrictEqual } from "node:util";

function getArgValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith("--")) return null;
  return value;
}

function getFlagEnabled(flag: string): boolean {
  return process.argv.includes(flag);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Blocked: dev-set-note-invoice-snapshot-risk-rating cannot run in production.");
  }

  const noteReference = getArgValue("--noteReference");
  const noteId = getArgValue("--noteId");
  const riskRatingRaw = getArgValue("--riskRating");
  const allowNonMarc = getFlagEnabled("--allowNonMarc");

  if (!noteReference && !noteId) {
    throw new Error("Provide --noteReference or --noteId.");
  }
  if (!riskRatingRaw) {
    throw new Error("Provide --riskRating (e.g. SME-3).");
  }
  if (!allowNonMarc && !isMarcSmeGrade(riskRatingRaw)) {
    throw new Error(
      `Invalid --riskRating "${riskRatingRaw}". Expected a MARC SME grade like SME-1..SME-10. ` +
        `If you're reverting a legacy value, pass --allowNonMarc.`
    );
  }

  const riskRating = allowNonMarc ? riskRatingRaw : (riskRatingRaw as MarcSmeGrade);
  const prisma = new PrismaClient();

  try {
    const note = await prisma.note.findFirst({
      where: noteId ? { id: noteId } : { note_reference: noteReference! },
      select: {
        id: true,
        note_reference: true,
        invoice_snapshot: true,
      },
    });

    if (!note) throw new Error("Note not found with the provided reference/id.");
    if (!note.invoice_snapshot) throw new Error("Selected note has null invoice_snapshot.");

    const invoiceSnapshot = note.invoice_snapshot as Prisma.JsonValue;
    const invoiceRecord = asRecord(invoiceSnapshot);
    if (!invoiceRecord) throw new Error("invoice_snapshot is not a JSON object.");

    const offerDetails = asRecord(invoiceRecord.offer_details);
    if (!offerDetails) throw new Error("invoice_snapshot.offer_details is missing or not an object.");

    const originalRiskRating = offerDetails.risk_rating;
    console.log("Original:");
    console.log({
      noteId: note.id,
      noteReference: note.note_reference,
      riskRating: originalRiskRating ?? null,
    });

    const beforeSnapshot = cloneJson(invoiceRecord);

    const updatedInvoiceSnapshot = {
      ...invoiceRecord,
      offer_details: {
        ...offerDetails,
        risk_rating: riskRating,
      },
    } satisfies Record<string, unknown>;

    const updated = await prisma.note.update({
      where: { id: note.id },
      data: {
        invoice_snapshot: updatedInvoiceSnapshot as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        note_reference: true,
        invoice_snapshot: true,
      },
    });

    if (!updated.invoice_snapshot) throw new Error("Unexpected: invoice_snapshot became null after update.");
    const updatedRecord = asRecord(updated.invoice_snapshot);
    if (!updatedRecord) throw new Error("Unexpected: updated invoice_snapshot is not an object.");
    const updatedOfferDetails = asRecord(updatedRecord.offer_details);
    if (!updatedOfferDetails) throw new Error("Unexpected: updated offer_details is missing.");

    const newRiskRating = updatedOfferDetails.risk_rating;
    console.log("After update:");
    console.log({
      noteId: updated.id,
      noteReference: updated.note_reference,
      riskRating: newRiskRating ?? null,
    });

    if (newRiskRating !== riskRating) {
      throw new Error(
        `Update verification failed: expected risk_rating=${riskRating} but got ${String(
          newRiskRating
        )}.`
      );
    }

    // Verify that only the nested risk_rating field changed.
    const beforeForCompare = cloneJson(beforeSnapshot);
    const afterForCompare = cloneJson(updatedRecord);
    const beforeOffer = asRecord(beforeForCompare.offer_details);
    const afterOffer = asRecord(afterForCompare.offer_details);
    if (!beforeOffer || !afterOffer) throw new Error("Unexpected: offer_details missing for compare.");
    delete beforeOffer.risk_rating;
    delete afterOffer.risk_rating;

    if (!isDeepStrictEqual(beforeForCompare, afterForCompare)) {
      throw new Error(
        "Update verification failed: invoice_snapshot changed in fields other than offer_details.risk_rating."
      );
    }

    console.log("OK: Only invoice_snapshot.offer_details.risk_rating was modified.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

