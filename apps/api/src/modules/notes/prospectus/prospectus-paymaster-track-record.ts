/**
 * SECTION: Build Page 2 Paymaster Track Record view-model
 * WHY: Always Data not available — no approved grouping key, formulas, or issuer reuse
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAYMASTER_TRACK_RECORD_AUDIT,
  PROSPECTUS_PAYMASTER_TRACK_RECORD_SECTION_HEADING,
  type ProspectusPaymasterTrackRecord,
  type ProspectusPaymasterTrackRecordInput,
} from "./prospectus-paymaster-track-record.types";

export function buildProspectusPaymasterTrackRecord(
  input: ProspectusPaymasterTrackRecordInput = {}
): ProspectusPaymasterTrackRecord {
  // Observational only — prove unsupported counts/amounts/issuer metrics/dates never become Canva values.
  void input.paymasterSnapshot;
  void input.currentNoteId;
  void input.invoicePaidCount;
  void input.noteCount;
  void input.fundedAmount;
  void input.targetAmount;
  void input.invoiceFaceValue;
  void input.paymentTotal;
  void input.issuerRepaidCount;
  void input.issuerArrearsCount;
  void input.issuerDefaultedCount;
  void input.issuerSuccessfulRepaymentPercent;
  void input.issuerOnTimePaymentPercent;
  void input.invoiceDueDate;
  void input.paymentReceivedDate;
  void input.maturityDate;
  void input.repaidAt;
  void input.matchingPaymasterNameRows;

  return {
    sectionHeading: PROSPECTUS_PAYMASTER_TRACK_RECORD_SECTION_HEADING,
    totalInvoicesPaid: PROSPECTUS_DATA_NOT_AVAILABLE,
    totalAmountPaid: PROSPECTUS_DATA_NOT_AVAILABLE,
    successfulRepaymentPercent: PROSPECTUS_DATA_NOT_AVAILABLE,
    onTimePayment: PROSPECTUS_DATA_NOT_AVAILABLE,
    averagePaymentPeriod: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: PROSPECTUS_PAYMASTER_TRACK_RECORD_AUDIT,
  };
}
