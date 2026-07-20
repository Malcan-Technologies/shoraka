import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildProspectusPaymasterTrackRecord } from "./prospectus-paymaster-track-record";
import { SAMPLE_PROSPECTUS_PAYMASTER_TRACK_RECORD_INPUT } from "./prospectus-paymaster-track-record.sample-data";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_PAYMASTER_TRACK_RECORD_FIELD_SOURCES,
  PROSPECTUS_PAYMASTER_TRACK_RECORD_FUTURE_MONEY_FORMATTER,
  PROSPECTUS_PAYMASTER_TRACK_RECORD_SECTION_HEADING,
} from "./prospectus-paymaster-track-record.types";
import { buildProspectusPaymasterTrackRecordDocument } from "./render-prospectus-paymaster-track-record";

describe("prospectus Page 2 Paymaster Track Record (DATA STAGE 3)", () => {
  it("uses static section heading", () => {
    const data = buildProspectusPaymasterTrackRecord(
      SAMPLE_PROSPECTUS_PAYMASTER_TRACK_RECORD_INPUT
    );
    expect(data.sectionHeading).toBe("PAYMASTER TRACK RECORD");
    expect(data.sectionHeading).toBe(PROSPECTUS_PAYMASTER_TRACK_RECORD_SECTION_HEADING);
  });

  it("returns DNA for all five metrics when officer inputs are missing", () => {
    const data = buildProspectusPaymasterTrackRecord(
      SAMPLE_PROSPECTUS_PAYMASTER_TRACK_RECORD_INPUT
    );
    expect(data.totalInvoicesPaid).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.totalAmountPaid).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.successfulRepaymentPercent).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.onTimePayment).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.averagePaymentPeriod).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);

    expect(data.totalInvoicesPaid).not.toBe("103");
    expect(data.totalAmountPaid).not.toMatch(/150|mil|million/);
    expect(data.successfulRepaymentPercent).not.toBe("100%");
    expect(data.onTimePayment).not.toBe("94%");
    expect(data.averagePaymentPeriod).not.toMatch(/94/);
  });

  it("formats officer-entered values for Canva display", () => {
    const data = buildProspectusPaymasterTrackRecord({
      officerInputs: {
        totalInvoicesPaid: 48,
        totalAmountPaid: "12500000",
        successfulRepaymentPercent: 98.5,
        onTimePaymentPercent: 94,
        averagePaymentPeriodDays: 32,
      },
    });
    expect(data.totalInvoicesPaid).toBe("48");
    expect(data.totalAmountPaid).toBe("RM 12,500,000.00");
    expect(data.successfulRepaymentPercent).toBe("98.5%");
    expect(data.onTimePayment).toBe("94%");
    expect(data.averagePaymentPeriod).toBe("32 days");
  });

  it("ignores Note/invoice counts and amount substitutes", () => {
    const data = buildProspectusPaymasterTrackRecord({
      invoicePaidCount: 103,
      noteCount: 12,
      fundedAmount: 150_000_000,
      targetAmount: 160_000_000,
      invoiceFaceValue: 625_000,
      paymentTotal: 150_000_000,
    });
    expect(data.totalInvoicesPaid).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.totalAmountPaid).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
  });

  it("does not reuse Page 1 issuer successful-repayment or six-month on-time metrics", () => {
    const data = buildProspectusPaymasterTrackRecord({
      issuerRepaidCount: 10,
      issuerArrearsCount: 0,
      issuerDefaultedCount: 0,
      issuerSuccessfulRepaymentPercent: 100,
      issuerOnTimePaymentPercent: 94,
    });
    expect(data.successfulRepaymentPercent).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.onTimePayment).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.successfulRepayment.issuerMetricReused).toBe(false);
    expect(data.audit.onTimePayment.issuerSixMonthMetricReused).toBe(false);

    const moduleSource = readFileSync(
      join(__dirname, "prospectus-paymaster-track-record.ts"),
      "utf8"
    );
    expect(moduleSource).not.toContain("track-record-aggregates");
    expect(moduleSource).not.toContain("buildProspectusIssuerTrackRecord");
    expect(moduleSource).not.toContain("computeProspectusSuccessfulRepaymentPercent");
    expect(moduleSource).not.toContain("computeOnTimePaymentRatePercent");
  });

  it("does not infer average payment period from date differences", () => {
    const data = buildProspectusPaymasterTrackRecord({
      invoiceDueDate: "2025-09-12T00:00:00.000Z",
      paymentReceivedDate: "2025-12-15T00:00:00.000Z",
      maturityDate: "2025-09-12T00:00:00.000Z",
      repaidAt: "2025-12-15T00:00:00.000Z",
    });
    expect(data.averagePaymentPeriod).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.averagePaymentPeriod).not.toMatch(/%|Days|days|0/);
  });

  it("does not implement name or SSM grouping aggregates", () => {
    const data = buildProspectusPaymasterTrackRecord({
      matchingPaymasterNameRows: [
        { name: "KKR", ssmNumber: "111" },
        { name: "KKR", ssmNumber: "111" },
      ],
      paymasterSnapshot: { name: "KKR", ssm_number: "111" },
    });
    expect(data.totalInvoicesPaid).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.totalAmountPaid).toBe(PROSPECTUS_DATA_NOT_AVAILABLE);
    expect(data.audit.identity.stableGroupingKeyAvailable).toBe(false);
    expect(data.audit.identity.nameGroupingApproved).toBe(false);
    expect(data.audit.identity.groupingDecision).toBe("pending");
  });

  it("documents officer-stored sources and money formatter", () => {
    expect(PROSPECTUS_PAYMASTER_TRACK_RECORD_FIELD_SOURCES.totalInvoicesPaid.availability).toBe(
      "stored"
    );
    expect(PROSPECTUS_PAYMASTER_TRACK_RECORD_FIELD_SOURCES.totalAmountPaid.availability).toBe(
      "stored"
    );
    expect(
      PROSPECTUS_PAYMASTER_TRACK_RECORD_FIELD_SOURCES.successfulRepaymentPercent.availability
    ).toBe("stored");
    expect(PROSPECTUS_PAYMASTER_TRACK_RECORD_FIELD_SOURCES.onTimePayment.availability).toBe(
      "stored"
    );
    expect(
      PROSPECTUS_PAYMASTER_TRACK_RECORD_FIELD_SOURCES.averagePaymentPeriod.availability
    ).toBe("stored");
    expect(PROSPECTUS_PAYMASTER_TRACK_RECORD_FIELD_SOURCES.successfulRepaymentPercent.label).toBe(
      "Successful Repayment"
    );
    expect(PROSPECTUS_PAYMASTER_TRACK_RECORD_FIELD_SOURCES.onTimePayment.label).toBe(
      "On-Time Payment"
    );
    expect(PROSPECTUS_PAYMASTER_TRACK_RECORD_FUTURE_MONEY_FORMATTER).toBe(
      "formatProspectusMoneyMyr"
    );
  });

  it("HTML shows exactly five metrics plus heading and hides audit/identity/claims", () => {
    const data = buildProspectusPaymasterTrackRecord({
      officerInputs: {
        totalInvoicesPaid: 48,
        totalAmountPaid: 12_500_000,
        successfulRepaymentPercent: 98.5,
        onTimePaymentPercent: 94,
        averagePaymentPeriodDays: 32,
      },
    });
    const html = buildProspectusPaymasterTrackRecordDocument(data);

    expect(html).toContain("PAYMASTER TRACK RECORD");
    expect(html).toContain("Total Invoices Paid:");
    expect(html).toContain("Total Amount Paid:");
    expect(html).toContain("Successful Repayment:");
    expect(html).toContain("On-Time Payment:");
    expect(html).toContain("Average Payment Period:");
    expect(html).toContain("48");
    expect(html).toContain("RM 12,500,000.00");
    expect(html).toContain("98.5%");
    expect(html).toContain("94%");
    expect(html).toContain("32 days");
    expect(html).not.toContain("Successful Repayment %:");
    expect(html).not.toContain("On-time Payment:");

    expect(html).not.toMatch(/\bmil\b|million|RM 150m/);
    expect(html).not.toContain("Excellent track record");
    expect(html).not.toContain("Strong payment history");
    expect(html).not.toContain("Reliable paymaster");
    expect(html).not.toContain("Zero defaults");
    expect(html).not.toContain("Consistent payments");

    expect(html).not.toContain("issuer");
    expect(html).not.toContain("Note count");
    expect(html).not.toContain("default count");
    expect(html).not.toContain("grouping");
    expect(html).not.toContain("Kementerian Kerja Raya");
    expect(html).not.toContain("1234567890");
    expect(html).not.toContain("stableGroupingKeyAvailable");
    expect(html).not.toContain("candidateKeys");
    expect(html).not.toContain("groupingDecision");
    expect(html).not.toContain('"audit"');
  });

  it("audit records officer content without issuer reuse or compact money", () => {
    const data = buildProspectusPaymasterTrackRecord();
    expect(data.audit.totalAmountPaid.compactMoneyAllowed).toBe(false);
    expect(data.audit.totalAmountPaid.futureMoneyFormatter).toBe("formatProspectusMoneyMyr");
    expect(data.audit.totalInvoicesPaid.isOfficerContent).toBe(true);
    expect(data.audit.totalInvoicesPaid.systemAggregateAvailable).toBe(false);
    expect(data.audit.successfulRepayment.issuerMetricReused).toBe(false);
    expect(data.audit.onTimePayment.issuerSixMonthMetricReused).toBe(false);
    expect(data.audit.claims.generatedPositiveClaimAllowed).toBe(false);
    expect(data.audit.snapshot.sourceType).toBe("officer_publication_content");
    expect(data.audit.snapshot.systemHistoryAvailable).toBe(false);
  });
});
