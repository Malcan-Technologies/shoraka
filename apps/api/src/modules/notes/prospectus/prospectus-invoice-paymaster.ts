/**
 * SECTION: Build Page 2 Invoice & Paymaster Information view-model
 * WHY: Face value + maturity + frozen paymaster; DOA/rating/confidence are officer content
 */

import {
  normalizeProspectusConfidenceGrading,
  normalizeProspectusDeedOfAssignment,
  normalizeProspectusPaymasterRating,
} from "@cashsouk/types";
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

  const deedOfAssignment =
    normalizeProspectusDeedOfAssignment(input.officerDeedOfAssignment) ??
    PROSPECTUS_DATA_NOT_AVAILABLE;
  const paymasterRating =
    normalizeProspectusPaymasterRating(input.officerPaymasterRating) ??
    PROSPECTUS_DATA_NOT_AVAILABLE;
  const confidenceGrading =
    normalizeProspectusConfidenceGrading(input.officerConfidenceGrading) ??
    PROSPECTUS_DATA_NOT_AVAILABLE;

  return {
    sectionHeading: PROSPECTUS_INVOICE_PAYMASTER_SECTION_HEADING,
    invoiceAmount: formatProspectusMoneyMyr(faceValue),
    invoiceDueDate: formatProspectusDateUtc(input.maturityDate),
    paymasterName: paymasterName ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    paymasterNature: paymasterNature ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    deedOfAssignment,
    paymasterRating,
    confidenceGrading,
    audit: PROSPECTUS_INVOICE_PAYMASTER_AUDIT,
  };
}

/**
 * Admin Prospectus Review rows — same labels/values as Page 2 Canva HTML.
 * Does not re-resolve invoice/paymaster data; maps an already-built Stage 2 view-model.
 */
export function toAdminInvoicePaymasterRows(
  section: ProspectusInvoicePaymaster
): Array<{ label: string; value: string }> {
  return [
    { label: "Invoice Amount", value: section.invoiceAmount },
    { label: "Invoice Due Date", value: section.invoiceDueDate },
    { label: "Paymaster", value: section.paymasterName },
    { label: "Nature of Paymaster", value: section.paymasterNature },
    { label: "Deed of Assignment (DOA)", value: section.deedOfAssignment },
    { label: "Paymaster Rating", value: section.paymasterRating },
    { label: "Confidence Grading", value: section.confidenceGrading },
  ];
}
