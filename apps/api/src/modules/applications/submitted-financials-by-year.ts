import {
  indexLatestSubmittedFinancialsByYear,
  indexResolvedApplicationFinancials,
  type ResolvedSubmittedFinancialIndex,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";

export { resolveLatestSubmittedFinancialsForYear } from "@cashsouk/types";

/**
 * Same-FY financials for new-application prefill.
 * Revision snapshots stay immutable. Live non-draft application JSON supplies Admin supplements
 * saved during review. Organisation profile JSON is not a prefill source.
 */
export async function loadLatestSubmittedFinancialsByYear(
  issuerOrganizationId: string
): Promise<ResolvedSubmittedFinancialIndex> {
  const [revisions, applications] = await Promise.all([
    prisma.applicationRevision.findMany({
      where: {
        application: { issuer_organization_id: issuerOrganizationId },
      },
      orderBy: [{ submitted_at: "desc" }, { created_at: "desc" }],
      select: { snapshot: true },
    }),
    prisma.application.findMany({
      where: {
        issuer_organization_id: issuerOrganizationId,
        status: { not: "DRAFT" },
      },
      orderBy: { updated_at: "desc" },
      select: { financial_statements: true },
    }),
  ]);

  const fromApplications = indexResolvedApplicationFinancials(
    applications.map((application) => ({ financialStatements: application.financial_statements }))
  );
  const fromRevisions = indexLatestSubmittedFinancialsByYear(revisions);
  return {
    submittedByYear: { ...fromRevisions, ...fromApplications.submittedByYear },
    adminSupplementsByYear: fromApplications.adminSupplementsByYear,
  };
}
