import {
  SETTLEMENT_HIBAH_RECEIPT_TEMPLATE_ID,
  SETTLEMENT_HIBAH_RECEIPT_VERSION_V01,
  type DocumentStampSource,
  type SettlementHibahReceiptGenerationSource,
} from "@cashsouk/types";

export const RECEIPT_TEMPLATE_ID = SETTLEMENT_HIBAH_RECEIPT_TEMPLATE_ID;
export const RECEIPT_FIRST_VERSION = SETTLEMENT_HIBAH_RECEIPT_VERSION_V01;

export const HIBAH_GRANTOR = "Participating Investors/Noteholders" as const;

export const HIBAH_ACTING_THROUGH =
  "Shoraka Suyula Platform Sdn Bhd as duly authorised agent for investor, issuer and platform operator" as const;

export const SETTLEMENT_STATUS_LABEL = "Fully settled" as const;

export const SETTLEMENT_CONFIRMATION_COPY =
  "Confirmation. We acknowledge receipt of the gross paymaster collection stated above. The settlement amount, including contracted profit through the maturity date, was applied to fully settle the financing. The remaining amount constitutes hibah granted by the participating Investors/Noteholders recorded in the stated Investor Schedule relating to the stated Financing Note. Shoraka Suyula Platform Sdn Bhd administers and pays the hibah as their duly authorised agent and platform operator under the approved Bai’ al-Dayn bi al-Sila’ structure. This receipt remains subject to final clearance, allocation and absence of payment reversal." as const;

export type ReceiptGenerationSource = SettlementHibahReceiptGenerationSource;

export type ClearedValueDateSource = "ACTUAL_SETTLEMENT_DATE" | "INCLUDED_PAYMENT_RECEIPT_DATE";

export type FrozenReceiptCompanyStamp = {
  s3Key: string;
  sha256: string | null;
  contentType: string | null;
  fileName: string | null;
};

export type ReceiptAuthorisationSnapshot = {
  stampSource: DocumentStampSource;
  companyStamp: FrozenReceiptCompanyStamp | null;
};

export type SettlementHibahReceiptSnapshot = {
  templateId: string;
  templateVersion: string;
  snapshotGeneratedAt: string;
  snapshotSha256: string;
  source: ReceiptGenerationSource;
  receiptNumber: string;
  version: string;
  receiptDate: string;
  receiptDateDisplay: string;
  settlementId: string;
  settlementReference: string;
  noteId: string;
  noteReference: string;
  facilityReference: string | null;
  issuerReference: string;
  issuerLegalName: string;
  issuerCompanyNumber: string;
  paymasterName: string;
  invoiceNumber: string;
  invoiceFaceValue: number;
  maturityDate: string | null;
  maturityDateDisplay: string;
  clearedValueDate: string;
  clearedValueDateDisplay: string;
  clearedValueDateSource: ClearedValueDateSource;
  paymentDate: string;
  paymentDateDisplay: string;
  paymentReference: string;
  settlementStatus: typeof SETTLEMENT_STATUS_LABEL;
  grossReceiptAmount: number;
  investorPrincipal: number;
  investorProfitGross: number;
  unpaidContractualFees: number;
  tawidhAmount: number;
  gharamahAmount: number;
  priorPaymentsCredits: number;
  totalApplied: number;
  hibahAmount: number;
  totalAllocated: number;
  unallocatedBalance: number;
  investorScheduleReference: string;
  hibahGrantor: typeof HIBAH_GRANTOR;
  hibahRecipient: string;
  actingThrough: typeof HIBAH_ACTING_THROUGH;
  shariahStructure: string;
  confirmationCopy: typeof SETTLEMENT_CONFIRMATION_COPY;
  authorisation: ReceiptAuthorisationSnapshot;
};

export class ReceiptGenerationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INCOMPLETE_DATA"
      | "NOT_ELIGIBLE"
      | "RECONCILIATION_FAILED"
      | "GOTENBERG_FAILED"
      | "S3_FAILED"
  ) {
    super(message);
    this.name = "ReceiptGenerationError";
  }
}

export function formatPaymentReferences(references: string[]): string {
  const unique = [
    ...new Set(
      references
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    ),
  ].sort((left, right) => left.localeCompare(right));
  if (unique.length === 0) return "—";
  return unique.join(" · ");
}
