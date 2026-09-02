import type { SettlementHibahReceiptSnapshot } from "./types";
import { formatReceiptAmount, formatReceiptCredit, formatReceiptRm } from "./receipt-format";

export type SettlementHibahReceiptDocxMergeData = {
  receiptNumber: string;
  receiptDate: string;
  issuerReference: string;
  issuerLegalName: string;
  companyRegistration: string;
  financingReference: string;
  paymasterName: string;
  invoiceReference: string;
  invoiceFaceValue: string;
  maturityDate: string;
  clearedValueDate: string;
  paymentReference: string;
  settlementStatus: string;
  grossReceiptAmount: string;
  investorPrincipal: string;
  investorProfitGross: string;
  unpaidContractualFees: string;
  tawidhAmount: string;
  gharamahAmount: string;
  priorPaymentsCredits: string;
  totalApplied: string;
  hibahGrossAmount: string;
  hibahAppliedAmount: string;
  hibahAmount: string;
  investorScheduleReference: string;
  noteReference: string;
  hibahGrantor: string;
  hibahRecipient: string;
  actingThrough: string;
  paymentDate: string;
  financingSettled: string;
  hibahToIssuer: string;
  totalAllocated: string;
  unallocatedBalance: string;
};

export function financingReferenceFromSnapshot(snapshot: SettlementHibahReceiptSnapshot): string {
  return snapshot.facilityReference
    ? `${snapshot.noteReference} / ${snapshot.facilityReference}`
    : snapshot.noteReference;
}

/**
 * Map a frozen receipt snapshot to docxtemplater values.
 * Does not rerun waterfall, profit, Hibah, Ta’widh or Gharamah math.
 */
export function buildSettlementHibahReceiptDocxMergeData(
  snapshot: SettlementHibahReceiptSnapshot
): SettlementHibahReceiptDocxMergeData {
  return {
    receiptNumber: snapshot.receiptNumber,
    receiptDate: snapshot.receiptDateDisplay,
    issuerReference: snapshot.issuerReference,
    issuerLegalName: snapshot.issuerLegalName,
    companyRegistration: snapshot.issuerCompanyNumber,
    financingReference: financingReferenceFromSnapshot(snapshot),
    paymasterName: snapshot.paymasterName,
    invoiceReference: snapshot.invoiceNumber,
    invoiceFaceValue: formatReceiptRm(snapshot.invoiceFaceValue),
    maturityDate: snapshot.maturityDateDisplay,
    clearedValueDate: snapshot.clearedValueDateDisplay,
    paymentReference: snapshot.paymentReference,
    settlementStatus: snapshot.settlementStatus,
    grossReceiptAmount: formatReceiptAmount(snapshot.grossReceiptAmount),
    investorPrincipal: formatReceiptAmount(snapshot.investorPrincipal),
    investorProfitGross: formatReceiptAmount(snapshot.investorProfitGross),
    unpaidContractualFees: formatReceiptAmount(snapshot.unpaidContractualFees),
    tawidhAmount: formatReceiptAmount(snapshot.tawidhAmount),
    gharamahAmount: formatReceiptAmount(snapshot.gharamahAmount),
    priorPaymentsCredits: formatReceiptCredit(snapshot.priorPaymentsCredits),
    totalApplied: formatReceiptAmount(snapshot.totalApplied),
    hibahGrossAmount: formatReceiptAmount(snapshot.grossReceiptAmount),
    hibahAppliedAmount: formatReceiptCredit(snapshot.totalApplied),
    hibahAmount: formatReceiptAmount(snapshot.hibahAmount),
    investorScheduleReference: snapshot.investorScheduleReference,
    noteReference: snapshot.noteReference,
    hibahGrantor: snapshot.hibahGrantor,
    hibahRecipient: snapshot.hibahRecipient,
    actingThrough: snapshot.actingThrough,
    paymentDate: snapshot.paymentDateDisplay,
    financingSettled: formatReceiptRm(snapshot.totalApplied),
    hibahToIssuer: formatReceiptRm(snapshot.hibahAmount),
    totalAllocated: formatReceiptRm(snapshot.totalAllocated),
    unallocatedBalance: formatReceiptRm(snapshot.unallocatedBalance),
  };
}
