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
    return {
      id: link.id ?? null,
      client_guarantor_id: link.client_guarantor_id ?? null,
      guarantor_type: link.guarantor_type ?? null,
      email: link.email ?? null,
      name: link.name ?? null,
      ic_number: link.ic_number ?? null,
      business_name: link.business_name ?? null,
      ssm_number: link.ssm_number ?? null,
      position: link.position ?? null,
      /** Preserves `guarantor_agreement` etc. for admin review / comparison UIs. */
      source_data: link.source_data ?? link.sourceData ?? null,
      aml_status: link.aml_status ?? null,
      aml_message_status: link.aml_message_status ?? null,
      last_triggered_at: link.last_triggered_at ?? null,
      last_synced_at: link.last_synced_at ?? null,
      updated_at: link.updated_at ?? null,
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
