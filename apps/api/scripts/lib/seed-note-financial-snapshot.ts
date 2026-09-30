/**
 * Seed helpers: approved Financial Review result + Note financial snapshot.
 *
 * A Note used by the Prospectus must carry `financial_snapshot`, a copy of the application's
 * APPROVED Financial Review result. Seeds insert Notes directly with Prisma, so they produce
 * that result through the real approval function and copy it the same way Note creation does.
 * Dev/test seeds only; blocked in production.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import type { ApprovedFinancialResult } from "@cashsouk/types";
import {
  approveFinancialReviewWithResult,
  loadCurrentApprovedFinancialResult,
} from "../../src/modules/admin/financial-approved-result";
import {
  buildNoteFinancialSnapshot,
  parseNoteFinancialSnapshot,
} from "../../src/modules/notes/note-financial-snapshot.types";

function assertNotProduction(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed financial approval is blocked in production");
  }
}

/**
 * Approve the seed application's Financial review with a stored result (through the real
 * approval function) and return that result. Idempotent.
 * Always re-approves, even when the row is already APPROVED with a parseable result: seeds are
 * re-runnable and rewrite financial_statements / CTOS rows, so the latest seed data must win.
 */
export async function seedApprovedFinancialReviewForApplication(
  db: PrismaClient,
  params: { applicationId: string; reviewerUserId?: string | null; approvedAt?: Date }
): Promise<ApprovedFinancialResult> {
  assertNotProduction();
  const { applicationId, reviewerUserId, approvedAt } = params;
  try {
    return await db.$transaction((tx) =>
      approveFinancialReviewWithResult(tx, {
        applicationId,
        reviewerUserId: reviewerUserId ?? null,
        approvedAt,
      })
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Seed could not approve Financial review for application ${applicationId}: ${reason}`,
      { cause: error }
    );
  }
}

/**
 * Copy the application's current approved Financial result onto the Note (approving it first
 * when there is none). Idempotent: re-runs overwrite the snapshot with the current result.
 */
export async function seedNoteFinancialSnapshot(
  db: PrismaClient,
  params: { noteId: string; applicationId: string; reviewerUserId?: string | null }
): Promise<void> {
  assertNotProduction();
  const { noteId, applicationId, reviewerUserId } = params;

  const note = await db.note.findUnique({
    where: { id: noteId },
    select: { created_at: true, source_application_id: true },
  });
  if (!note) {
    throw new Error(`Seed Note ${noteId} not found while copying the financial snapshot`);
  }
  if (note.source_application_id !== applicationId) {
    throw new Error(
      `Seed Note ${noteId} belongs to application ${note.source_application_id}, not ${applicationId}`
    );
  }

  const result =
    (await loadCurrentApprovedFinancialResult(db, applicationId)) ??
    (await seedApprovedFinancialReviewForApplication(db, { applicationId, reviewerUserId }));

  const snapshot = buildNoteFinancialSnapshot(result, note.created_at);
  const stored = await db.note.update({
    where: { id: noteId },
    data: { financial_snapshot: snapshot as unknown as Prisma.InputJsonValue },
    select: { financial_snapshot: true },
  });
  // Verify what was stored, not what was built: this is what the Prospectus will read.
  if (!parseNoteFinancialSnapshot(stored.financial_snapshot)) {
    throw new Error(`Seed Note ${noteId} financial snapshot does not parse after write`);
  }
}
