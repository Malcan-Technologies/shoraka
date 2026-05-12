/**
 * Note listing expiry job: auto-closes marketplace listings in two scenarios:
 *   1. The listing's `note_listings.closes_at` has elapsed. Notes that met the
 *      minimum funding threshold are auto-closed as funded; those that did not
 *      are auto-failed and investor commitments released.
 *   2. The note is fully funded (funded_amount >= target_amount) — closed early
 *      as a safety net in case the inline auto-close on commit failed.
 *
 * Runs hourly as a cron job; can also be invoked manually via the
 * run-note-listing-expiry script.
 */

import { NoteFundingStatus, NoteStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { logger } from "../logger";
import { noteService } from "../../modules/notes/service";

const SYSTEM_USER_ID = "SYS";
const CRON_CORRELATION_ID = "cron:note-listing-expiry";

export type NoteListingExpiryResult = {
  notesAutoFunded: string[];
  notesAutoFailed: string[];
  errors: Array<{ noteId: string; error: string }>;
};

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof (value as { toNumber?: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

export async function runNoteListingExpiryJob(): Promise<NoteListingExpiryResult> {
  const result: NoteListingExpiryResult = {
    notesAutoFunded: [],
    notesAutoFailed: [],
    errors: [],
  };

  const now = new Date();
  const openNotes = await prisma.note.findMany({
    where: {
      status: NoteStatus.PUBLISHED,
      funding_status: NoteFundingStatus.OPEN,
    },
    select: {
      id: true,
      target_amount: true,
      funded_amount: true,
      minimum_funding_percent: true,
      listing: { select: { closes_at: true } },
    },
  });

  const candidateNotes = openNotes.filter((note) => {
    const target = toNumber(note.target_amount);
    const funded = toNumber(note.funded_amount);
    const isFullyFunded = target > 0 && funded + 0.005 >= target;
    const isExpired = Boolean(note.listing?.closes_at && note.listing.closes_at <= now);
    return isFullyFunded || isExpired;
  });

  if (candidateNotes.length === 0) return result;

  const actor = {
    userId: SYSTEM_USER_ID,
    role: "ADMIN" as const,
    portal: "ADMIN" as const,
    correlationId: CRON_CORRELATION_ID,
  };

  for (const note of candidateNotes) {
    const targetAmount = toNumber(note.target_amount);
    const fundedAmount = toNumber(note.funded_amount);
    const minimumPercent = toNumber(note.minimum_funding_percent);
    const fundingPercent = targetAmount > 0 ? (fundedAmount / targetAmount) * 100 : 0;
    const meetsMinimum = fundingPercent + 0.005 >= minimumPercent;

    try {
      if (meetsMinimum) {
        await noteService.closeFunding(note.id, actor);
        result.notesAutoFunded.push(note.id);
      } else {
        await noteService.failFunding(note.id, actor);
        result.notesAutoFailed.push(note.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ noteId: note.id, error: message });
      logger.error(
        { err, noteId: note.id, fundingPercent, meetsMinimum },
        "Note listing expiry job: failed to auto-close note"
      );
    }
  }

  logger.info(
    {
      notesAutoFunded: result.notesAutoFunded.length,
      notesAutoFailed: result.notesAutoFailed.length,
      errors: result.errors.length,
    },
    "Note listing expiry job completed"
  );

  return result;
}
