import { indexLatestSubmittedFinancialsByYear } from "@cashsouk/types";
import { prisma } from "../../lib/prisma";

export { resolveLatestSubmittedFinancialsForYear } from "@cashsouk/types";

/**
 * Same-FY submitted application financials for new-application prefill.
 * Canonical source: ApplicationRevision.snapshot (submit/resubmit), not live drafts
 * and not organisation profile JSON.
 */
export async function loadLatestSubmittedFinancialsByYear(
  issuerOrganizationId: string
): Promise<Record<string, Record<string, unknown>>> {
  const revisions = await prisma.applicationRevision.findMany({
    where: {
      application: { issuer_organization_id: issuerOrganizationId },
    },
    orderBy: [{ submitted_at: "desc" }, { created_at: "desc" }],
    select: { snapshot: true },
  });
  return indexLatestSubmittedFinancialsByYear(revisions);
}
