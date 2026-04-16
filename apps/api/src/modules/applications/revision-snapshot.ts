/**
 * Single builder for application_revisions.snapshot JSON so first-submit and resubmit stay aligned.
 */

import type { Prisma } from "@prisma/client";

export type BuildApplicationRevisionSnapshotInput = {
  financing_type: Prisma.JsonValue | null;
  product_version: number | null | undefined;
  /** Frozen at submit/resubmit; live row clears on resubmit — kept here for audit/timeline. */
  amendment_acknowledged_workflow_ids?: string[] | null;
  financing_structure: Prisma.JsonValue | null;
  company_details: Prisma.JsonValue | null;
  business_details: Prisma.JsonValue | null;
  application_guarantors?: unknown;
  financial_statements: Prisma.JsonValue | null;
  supporting_documents: Prisma.JsonValue | null;
  declarations: Prisma.JsonValue | null;
  review_and_submit: Prisma.JsonValue | null;
  last_completed_step: number;
  contract_id: string | null;
  contract: unknown;
  invoices: unknown;
  issuer_organization: unknown;
};

export function buildApplicationRevisionSnapshot(
  appFull: BuildApplicationRevisionSnapshotInput
): Prisma.InputJsonValue {
  const ft = appFull.financing_type as { product_id?: string } | null | undefined;
  const invoices = Array.isArray(appFull.invoices) ? appFull.invoices : [];
  const ackRaw = appFull.amendment_acknowledged_workflow_ids;
  const amendment_acknowledged_workflow_ids = Array.isArray(ackRaw)
    ? ackRaw.filter((id): id is string => typeof id === "string")
    : [];

  const applicationGuarantors = Array.isArray(appFull.application_guarantors)
    ? appFull.application_guarantors
    : [];
  const guarantors = applicationGuarantors.map((row) => {
    const link =
      row && typeof row === "object" && !Array.isArray(row)
        ? (row as Record<string, unknown>)
        : {};
    const guarantor =
      link.guarantor && typeof link.guarantor === "object" && !Array.isArray(link.guarantor)
        ? (link.guarantor as Record<string, unknown>)
        : {};
    return {
      id: guarantor.id ?? null,
      canonical_key: guarantor.canonical_key ?? null,
      guarantor_type: guarantor.guarantor_type ?? null,
      email: guarantor.email ?? null,
      first_name: guarantor.first_name ?? null,
      last_name: guarantor.last_name ?? null,
      company_name: guarantor.company_name ?? null,
      ic_number: guarantor.ic_number ?? null,
      ssm_number: guarantor.ssm_number ?? null,
      relationship: link.relationship ?? null,
      position: link.position ?? null,
      aml_status: guarantor.aml_status ?? null,
      aml_message_status: guarantor.aml_message_status ?? null,
      aml_risk_score: guarantor.aml_risk_score ?? null,
      aml_risk_level: guarantor.aml_risk_level ?? null,
      onboarding_request_id: guarantor.onboarding_request_id ?? null,
      onboarding_verify_link: guarantor.onboarding_verify_link ?? null,
      regtank_portal_url: guarantor.regtank_portal_url ?? null,
      onboarding_status: guarantor.onboarding_status ?? null,
      onboarding_substatus: guarantor.onboarding_substatus ?? null,
      last_synced_at: guarantor.last_synced_at ?? null,
      updated_at: guarantor.updated_at ?? null,
    };
  });

  return {
    product: {
      id: ft?.product_id ?? null,
      version: appFull.product_version ?? null,
    },
    amendment_acknowledged_workflow_ids,
    application: {
      financing_type: appFull.financing_type,
      financing_structure: appFull.financing_structure,
      company_details: appFull.company_details,
      business_details: appFull.business_details,
      guarantors,
      financial_statements: appFull.financial_statements,
      supporting_documents: appFull.supporting_documents,
      declarations: appFull.declarations,
      review_and_submit: appFull.review_and_submit,
      last_completed_step: appFull.last_completed_step,
      contract_id: appFull.contract_id,
    },
    contract: appFull.contract ?? null,
    invoices,
    issuer_organization: appFull.issuer_organization ?? null,
  };
}
