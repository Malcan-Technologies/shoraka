/**
 * Single builder for application_revisions.snapshot JSON so first-submit and resubmit stay aligned.
 */

import type { Prisma } from "@prisma/client";

export type BuildApplicationRevisionSnapshotInput = {
  financing_type: Prisma.JsonValue | null;
  product_version: number | null | undefined;
  financing_structure: Prisma.JsonValue | null;
  company_details: Prisma.JsonValue | null;
  business_details: Prisma.JsonValue | null;
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

  return {
    product: {
      id: ft?.product_id ?? null,
      version: appFull.product_version ?? null,
    },
    application: {
      financing_type: appFull.financing_type,
      financing_structure: appFull.financing_structure,
      company_details: appFull.company_details,
      business_details: appFull.business_details,
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
