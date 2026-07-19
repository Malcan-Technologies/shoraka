/**
 * SECTION: Build Page 2 Paymaster Track Record view-model
 * WHY: Officer-entered prospectus-review values only — never issuer/paymaster fabricated metrics
 */

import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import { parseProspectusFinancialNumber } from "./prospectus-financial-comparison-metrics";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAYMASTER_TRACK_RECORD_AUDIT,
  PROSPECTUS_PAYMASTER_TRACK_RECORD_SECTION_HEADING,
  type ProspectusPaymasterTrackRecord,
  type ProspectusPaymasterTrackRecordInput,
} from "./prospectus-paymaster-track-record.types";

function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return String(Math.trunc(value));
}

function formatPercent(value: unknown): string {
  const n = parseProspectusFinancialNumber(value);
  if (n == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return `${n}%`;
}

function formatDays(value: unknown): string {
  const n = parseProspectusFinancialNumber(value);
  if (n == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return `${n} days`;
}

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

  const officer = input.officerInputs;
  const amount = parseProspectusFinancialNumber(officer?.totalAmountPaid);

  return {
    sectionHeading: PROSPECTUS_PAYMASTER_TRACK_RECORD_SECTION_HEADING,
    totalInvoicesPaid: formatCount(officer?.totalInvoicesPaid ?? null),
    totalAmountPaid:
      amount == null ? PROSPECTUS_DATA_NOT_AVAILABLE : formatProspectusMoneyMyr(amount),
    successfulRepaymentPercent: formatPercent(officer?.successfulRepaymentPercent),
    onTimePayment: formatPercent(officer?.onTimePaymentPercent),
    averagePaymentPeriod: formatDays(officer?.averagePaymentPeriodDays),
    audit: PROSPECTUS_PAYMASTER_TRACK_RECORD_AUDIT,
  };
}
