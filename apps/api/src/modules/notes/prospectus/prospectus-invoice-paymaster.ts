/**
 * SECTION: Build Page 2 Invoice & Paymaster Information view-model
 * WHY: Face value + maturity + frozen paymaster only; DOA/rating/confidence stay DNA
 */

import { formatProspectusDateUtc } from "./prospectus-dates-paymaster";
import {
  parseInvoiceSnapshotFaceValue,
  parsePaymasterSnapshot,
} from "./prospectus-json-guards";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_INVOICE_PAYMASTER_AUDIT,
  PROSPECTUS_INVOICE_PAYMASTER_SECTION_HEADING,
  type ProspectusInvoicePaymaster,
  type ProspectusInvoicePaymasterInput,
} from "./prospectus-invoice-paymaster.types";

function nonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildProspectusInvoicePaymaster(
  input: ProspectusInvoicePaymasterInput
): ProspectusInvoicePaymaster {
  // Observational only — prove target/funded/live invoice/docs never become Canva values.
  void input.targetAmount;
  void input.fundedAmount;
  void input.liveInvoiceMaturityDate;
  void input.supportingDocuments;

  const faceValue = parseInvoiceSnapshotFaceValue(input.invoiceSnapshot);
  const paymaster = parsePaymasterSnapshot(input.paymasterSnapshot);
  const paymasterName = nonEmptyString(paymaster.name);
  const paymasterNature = nonEmptyString(paymaster.entityType);

  return {
    sectionHeading: PROSPECTUS_INVOICE_PAYMASTER_SECTION_HEADING,
    invoiceAmount: formatProspectusMoneyMyr(faceValue),
    invoiceDueDate: formatProspectusDateUtc(input.maturityDate),
    paymasterName: paymasterName ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    paymasterNature: paymasterNature ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    deedOfAssignment: PROSPECTUS_DATA_NOT_AVAILABLE,
    paymasterRating: PROSPECTUS_DATA_NOT_AVAILABLE,
    confidenceGrading: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: PROSPECTUS_INVOICE_PAYMASTER_AUDIT,
  };
}
