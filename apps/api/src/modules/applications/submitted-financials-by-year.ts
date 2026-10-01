import {
  indexIssuerSubmittedFinancialYears,
  type IssuerSubmittedFinancialYear,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";

/**
 * Issuer Profile / new-application prefill: latest issuer User Input per FY.
 * Reads immutable `ApplicationRevision` snapshots only, whatever the application's later status.
 * Applications without a revision contribute nothing. Never reads live application JSON,
 * Admin Input, CTOS gap fills, or `updated_at`.
 */
export async function loadIssuerSubmittedFinancialYears(
  issuerOrganizationId: string
): Promise<Record<string, IssuerSubmittedFinancialYear>> {
  // Unbounded on purpose: the per-FY index needs the organisation's full revision history
  // (same scope as before). One row per submit / resubmit, scoped to a single organisation.
  const revisions = await prisma.applicationRevision.findMany({
    where: { application: { issuer_organization_id: issuerOrganizationId } },
    select: {
      id: true,
      application_id: true,
      review_cycle: true,
      submitted_at: true,
      snapshot: true,
    },
  });

  return indexIssuerSubmittedFinancialYears(
    revisions.map((revision) => ({
      revisionId: revision.id,
      applicationId: revision.application_id,
      reviewCycle: revision.review_cycle,
      submittedAt: revision.submitted_at,
      snapshot: revision.snapshot,
    }))
  );
}
