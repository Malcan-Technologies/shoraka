import { PROSPECTUS_FIXED_SHARIAH_PRINCIPLE } from "@cashsouk/types";
import { buildSettlementHibahReceiptHtml } from "./receipt-html";
import {
  HIBAH_ACTING_THROUGH,
  HIBAH_GRANTOR,
  SETTLEMENT_CONFIRMATION_COPY,
  type SettlementHibahReceiptSnapshot,
} from "./types";

const snapshot: SettlementHibahReceiptSnapshot = {
  templateId: "settlement-hibah-receipt-issuer-v1",
  templateVersion: "V01",
  snapshotGeneratedAt: "2026-09-02T03:00:00.000Z",
  snapshotSha256: "abc",
  source: "SETTLEMENT_COMPLETED",
  receiptNumber: "SET-ARF-202608-A52",
  version: "V01",
  receiptDate: "2026-09-02T03:00:00.000Z",
  receiptDateDisplay: "02 Sep 2026",
  settlementId: "set-1",
  settlementReference: "SET-ARF-202608-A52",
  noteId: "note-1",
  noteReference: "ARF-202608-A52",
  facilityReference: "FAC-1",
  issuerReference: "ISS-1",
  issuerLegalName: "Helios Sdn Bhd",
  issuerCompanyNumber: "1234567-A",
  paymasterName: "Paymaster Co",
  invoiceNumber: "INV-9",
  invoiceFaceValue: 100_000,
  maturityDate: "2026-11-30T00:00:00.000Z",
  maturityDateDisplay: "30 Nov 2026",
  clearedValueDate: "2026-08-15T00:00:00.000Z",
  clearedValueDateDisplay: "15 Aug 2026",
  clearedValueDateSource: "ACTUAL_SETTLEMENT_DATE",
  paymentDate: "2026-08-15T00:00:00.000Z",
  paymentDateDisplay: "15 Aug 2026",
  paymentReference: "BANK-REF-1",
  settlementStatus: "Fully settled",
  grossReceiptAmount: 105_000,
  investorPrincipal: 100_000,
  investorProfitGross: 3_000,
  unpaidContractualFees: 0,
  tawidhAmount: 200,
  gharamahAmount: 50,
  priorPaymentsCredits: 0,
  totalApplied: 103_250,
  hibahAmount: 1_750,
  totalAllocated: 105_000,
  unallocatedBalance: 0,
  investorScheduleReference: "IS-ARF-202608-A52-V01",
  hibahGrantor: HIBAH_GRANTOR,
  hibahRecipient: "Helios Sdn Bhd",
  actingThrough: HIBAH_ACTING_THROUGH,
  shariahStructure: PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
  confirmationCopy: SETTLEMENT_CONFIRMATION_COPY,
};

describe("buildSettlementHibahReceiptHtml", () => {
  it("recreates the issuer-copy legal sections and frozen amounts", () => {
    const html = buildSettlementHibahReceiptHtml(snapshot);
    expect(html).toContain("SETTLEMENT AND HIBAH RECEIPT");
    expect(html).toContain("PAID — ISSUER COPY");
    expect(html).toContain("SET-ARF-202608-A52");
    expect(html).toContain("GROSS COLLECTION");
    expect(html).toContain("APPLICATION TOWARDS SETTLEMENT");
    expect(html).toContain("HIBAH (REFUND)");
    expect(html).toContain("HIBAH DETAILS AND FINAL RECONCILIATION");
    expect(html).toContain("SETTLEMENT CONFIRMATION");
    expect(html).toContain("Company Stamp");
    expect(html).toContain("Contracted profit payable");
    expect(html).toContain("Full tenure to maturity");
    expect(html).toContain("Unpaid contractual fees");
    expect(html).toContain("IS-ARF-202608-A52-V01");
    expect(html).toContain(HIBAH_GRANTOR);
    expect(html).toContain("Helios Sdn Bhd");
    expect(html).toMatch(/1,750\.00|1750\.00/);
    expect(html).toMatch(/103,250\.00|103250\.00/);
    expect(html).not.toContain("SR-YYYY-0000");
  });
});
