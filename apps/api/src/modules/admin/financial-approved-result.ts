/**
 * SECTION: Approved Financial Review result
 * WHY: Financial approval stores exactly the result the Financial Review resolved and calculated,
 * in the same row write as status APPROVED. Note creation copies it; the Prospectus displays it.
 */

import { ReviewStepStatus, type Prisma, type PrismaClient } from "@prisma/client";
import {
  APPROVED_FINANCIAL_RESULT_VERSION,
  parseApprovedFinancialResult,
  resolveFinancialReviewResult,
  type ApprovedFinancialResult,
} from "@cashsouk/types";
import { canonicalizeJsonNumbers } from "../../lib/canonical-json-numbers";
import { AppError } from "../../lib/http/error-handler";
import { loadApplicationOwnedCtosFinancialReport } from "../applications/application-owned-ctos";

type Db = PrismaClient | Prisma.TransactionClient;

type CtosFetchState = "not_pulled" | "no_records" | "has_data";

function ctosFetchStateOf(report: { financialsJson: unknown } | null): CtosFetchState {
  if (!report) return "not_pulled";
  const rows = report.financialsJson;
  return Array.isArray(rows) && rows.length > 0 ? "has_data" : "no_records";
}

/** Resolve and calculate the Financial Review result for an application as it stands now. Pure read. */
export async function buildApprovedFinancialResult(params: {
  db: Db;
  applicationId: string;
  approvedAt: Date;
  reviewerUserId: string | null;
}): Promise<ApprovedFinancialResult> {
  const { db, applicationId, approvedAt, reviewerUserId } = params;
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
  if (!application) throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");

  const report = await loadApplicationOwnedCtosFinancialReport({
    issuerOrganizationId: application.issuer_organization_id,
    submittedAt: application.submitted_at,
    db,
  });

  const resolved = resolveFinancialReviewResult({
    financialStatements: application.financial_statements,
    ctosFinancials: report?.financialsJson ?? null,
    // submitted_at is set once at first submission, so resubmits keep the same year selection.
    referenceDate: application.submitted_at ?? approvedAt,
    ctosFetchState: ctosFetchStateOf(report),
  });

  const result = canonicalizeJsonNumbers<ApprovedFinancialResult>({
    ...resolved,
    version: APPROVED_FINANCIAL_RESULT_VERSION,
    application_id: application.id,
    review_cycle: application.review_cycle,
    approved_at: approvedAt.toISOString(),
    reviewer_user_id: reviewerUserId,
    ctos_report: report
      ? { report_id: report.id, fetched_at: report.fetchedAt.toISOString() }
      : null,
  });
  if (!parseApprovedFinancialResult(result)) {
    throw new AppError(
      500,
      "FINANCIAL_APPROVED_RESULT_INVALID",
      "Financial review result could not be built"
    );
  }
  return result;
}

/**
 * Inside a transaction: lock the application row, build the result, write status APPROVED and
 * the result in one row write. The lock serialises with Admin financial edits, which take the
 * same lock and re-check the Financial status, so no edit lands after the result is built.
 */
export async function approveFinancialReviewWithResult(
  tx: Prisma.TransactionClient,
  params: { applicationId: string; reviewerUserId: string | null; approvedAt?: Date }
): Promise<ApprovedFinancialResult> {
  const { applicationId, reviewerUserId } = params;
  const approvedAt = params.approvedAt ?? new Date();
  await tx.$queryRaw`SELECT id FROM applications WHERE id = ${applicationId} FOR UPDATE`;

  const result = await buildApprovedFinancialResult({
    db: tx,
    applicationId,
    approvedAt,
    reviewerUserId,
  });
  const snapshot = result as unknown as Prisma.InputJsonValue;
  await tx.applicationReview.upsert({
    where: {
      application_id_section: { application_id: applicationId, section: "financial" },
    },
    create: {
      application_id: applicationId,
      section: "financial",
      status: ReviewStepStatus.APPROVED,
      reviewer_user_id: reviewerUserId,
      reviewed_at: approvedAt,
      approved_snapshot: snapshot,
    },
    update: {
      status: ReviewStepStatus.APPROVED,
      reviewer_user_id: reviewerUserId,
      reviewed_at: approvedAt,
      approved_snapshot: snapshot,
    },
  });
  return result;
}

/** The current approved result: only when the Financial row is APPROVED and its snapshot parses. */
export async function loadCurrentApprovedFinancialResult(
  db: Db,
  applicationId: string
): Promise<ApprovedFinancialResult | null> {
  const review = await db.applicationReview.findUnique({
    where: {
      application_id_section: { application_id: applicationId, section: "financial" },
    },
    select: { status: true, approved_snapshot: true },
  });
  // A leftover snapshot on a reopened row is stale and must never be treated as current.
  if (review?.status !== ReviewStepStatus.APPROVED) return null;
  return parseApprovedFinancialResult(review.approved_snapshot);
}
