/**
 * SECTION: Map stored revision snapshot JSON to admin SectionContent `app` shape
 * WHY: Comparison modal renders sections from snapshots, not live Prisma joins.
 * INPUT: application id + snapshot object from GET resubmit-comparison
 * OUTPUT: Partial app object compatible with SectionContent
 * WHERE USED: ResubmitComparisonModal
 */

import type { ReviewApplicationView } from "@/components/application-review/section-content";

export function revisionSnapshotToReviewApp(
  applicationId: string,
  snapshot: Record<string, unknown>
): ReviewApplicationView {
  console.log("revisionSnapshotToReviewApp for applicationId:", applicationId);
  const app = (snapshot.application as Record<string, unknown> | undefined) ?? {};
  const issuerOrg = snapshot.issuer_organization as Record<string, unknown> | null | undefined;
  const issuerOrgId =
    typeof issuerOrg?.id === "string"
      ? issuerOrg.id
      : typeof app.issuer_organization_id === "string"
        ? app.issuer_organization_id
        : undefined;

  return {
    id: applicationId,
    financing_type: app.financing_type,
    financing_structure: app.financing_structure,
    company_details: app.company_details,
    business_details: app.business_details,
    application_guarantors: Array.isArray(app.guarantors) ? app.guarantors : [],
    financial_statements: app.financial_statements,
    supporting_documents: app.supporting_documents,
    declarations: app.declarations,
    review_and_submit: app.review_and_submit,
    contract: (snapshot.contract ?? null) as ReviewApplicationView["contract"],
    invoices: (Array.isArray(snapshot.invoices) ? snapshot.invoices : []) as NonNullable<
      ReviewApplicationView["invoices"]
    >,
    issuer_organization: (issuerOrg ?? null) as ReviewApplicationView["issuer_organization"],
    issuer_organization_id: issuerOrgId,
    application_review_items: [],
    application_review_remarks: [],
  };
}
