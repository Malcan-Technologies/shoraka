import {
  buildProspectusPaymasterTrackRecord,
  toAdminPaymasterTrackRecordRows,
} from "./prospectus-paymaster-track-record";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-paymaster-track-record.types";

describe("toAdminPaymasterTrackRecordRows", () => {
  it("maps DNA when officer inputs are missing", () => {
    expect(toAdminPaymasterTrackRecordRows(buildProspectusPaymasterTrackRecord())).toEqual([
      { label: "Total Invoices Paid", value: PROSPECTUS_DATA_NOT_AVAILABLE },
      { label: "Total Amount Paid", value: PROSPECTUS_DATA_NOT_AVAILABLE },
      { label: "Successful Repayment", value: PROSPECTUS_DATA_NOT_AVAILABLE },
      { label: "On-Time Payment", value: PROSPECTUS_DATA_NOT_AVAILABLE },
      { label: "Average Payment Period", value: PROSPECTUS_DATA_NOT_AVAILABLE },
    ]);
  });

  it("maps formatted officer-entered values like Preview HTML", () => {
    const section = buildProspectusPaymasterTrackRecord({
      officerInputs: {
        totalInvoicesPaid: 48,
        totalAmountPaid: "12500000",
        successfulRepaymentPercent: 98.5,
        onTimePaymentPercent: 94,
        averagePaymentPeriodDays: 32,
      },
      invoicePaidCount: 999,
      fundedAmount: 1,
      issuerSuccessfulRepaymentPercent: 100,
    });

    expect(toAdminPaymasterTrackRecordRows(section)).toEqual([
      { label: "Total Invoices Paid", value: "48" },
      { label: "Total Amount Paid", value: "RM 12,500,000.00" },
      { label: "Successful Repayment", value: "98.5%" },
      { label: "On-Time Payment", value: "94%" },
      { label: "Average Payment Period", value: "32 days" },
    ]);
  });
});
