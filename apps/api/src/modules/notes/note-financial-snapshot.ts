/**
 * SECTION: Build frozen notes.financial_snapshot at Note create
 * WHY: Prospectus financials must come from the reviewed application inputs, not live data
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { loadApplicationOwnedCtosFinancialReport } from "../applications/application-owned-ctos";
import {
  NOTE_FINANCIAL_SNAPSHOT_VERSION,
  type NoteFinancialSnapshot,
} from "./note-financial-snapshot.types";

type SnapshotReader = PrismaClient | Prisma.TransactionClient;

export async function buildNoteFinancialSnapshot(params: {
  db: SnapshotReader;
  applicationId: string;
  /** Note creation time. */
  capturedAt: Date;
}): Promise<NoteFinancialSnapshot> {
  const { db, applicationId } = params;
  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      issuer_organization_id: true,
      submitted_at: true,
      review_cycle: true,
      financial_statements: true,
    },
  });
  if (!application) {
    throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
  }

  const financialReview = await db.applicationReview.findUnique({
    where: { application_id_section: { application_id: applicationId, section: "financial" } },
    select: { status: true, reviewed_at: true, reviewer_user_id: true },
  });
  const ctos = await loadApplicationOwnedCtosFinancialReport({
    issuerOrganizationId: application.issuer_organization_id,
    submittedAt: application.submitted_at,
    db,
  });

  const capturedAt = params.capturedAt.toISOString();
  const submittedAt = application.submitted_at?.toISOString() ?? null;
  return {
    version: NOTE_FINANCIAL_SNAPSHOT_VERSION,
    captured_at: capturedAt,
    reference_date: submittedAt ?? capturedAt,
    financial_statements: application.financial_statements ?? null,
    ctos: ctos
      ? {
          report_id: ctos.id,
          fetched_at: ctos.fetchedAt.toISOString(),
          financials: ctos.financialsJson ?? null,
        }
      : null,
    source: {
      application_id: application.id,
      review_cycle: application.review_cycle,
      application_submitted_at: submittedAt,
      financial_review: {
        status: financialReview?.status ?? null,
        reviewed_at: financialReview?.reviewed_at?.toISOString() ?? null,
        reviewer_user_id: financialReview?.reviewer_user_id ?? null,
      },
    },
  };
}
