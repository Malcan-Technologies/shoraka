import { PROSPECTUS_FIXED_PAYMENT_BASIS, PROSPECTUS_FIXED_SHARIAH_PRINCIPLE } from "@cashsouk/types";
import type { CertificateSnapshotInvestor, InvestmentNoteCertificateSnapshot } from "./types";

export function sampleInvestmentNoteCertificateSnapshot(
  investors?: CertificateSnapshotInvestor[]
): InvestmentNoteCertificateSnapshot {
  return {
    templateId: "islamic-investment-note-certificate-v1",
    templateVersion: "V01",
    snapshotGeneratedAt: "2026-09-02T03:00:00.000Z",
    snapshotSha256: "abc",
    certificate: {
      certificateNumber: "IINC-NOTE-20260902-AAA",
      version: "V01",
      certificateDate: "2026-09-02T03:00:00.000Z",
      certificateDateDisplay: "02 Sep 2026",
    },
    note: {
      noteId: "note-1",
      noteReference: "NOTE-20260902-AAA",
      campaignReference: "NOTE-20260902-AAA",
      issuerReference: "ISS-001",
      businessSector: "Manufacturing",
      issuerLegalName: "Helios Manufacturing Sdn Bhd",
      companyRegistrationNumber: "1234567-A",
      campaignStatus: "Successfully funded",
      fundingCloseDate: "2026-08-01T00:00:00.000Z",
      fundingCloseDateDisplay: "1 August 2026",
      targetAmount: 100_000,
      fundedAmount: 80_000,
      principalAmount: 80_000,
      currency: "Malaysian Ringgit (RM)",
      profitRatePercent: 12,
      contractedProfit: 2_000,
      contractedProfitCapped: false,
      totalAmountPayable: 82_000,
      repaymentProfile: PROSPECTUS_FIXED_PAYMENT_BASIS,
      issueDate: "2026-09-01T00:00:00.000Z",
      issueDateDisplay: "1 September 2026",
      disbursementValueDate: "2026-09-01T00:00:00.000Z",
      disbursementValueDateDisplay: "1 September 2026",
      tenureDays: 90,
      maturityDate: "2026-11-30T00:00:00.000Z",
      maturityDateDisplay: "30 November 2026",
      shariahStructure: PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
      riskRating: "SME-4",
      underlyingInvoice: "INV-99",
      paymaster: "Paymaster Co",
      financingPurpose: "Working capital",
      securitySupport: "—",
    },
    investorSchedule: {
      scheduleReference: "IS-NOTE-20260902-AAA-V01",
      version: "V01",
      status: "Approved / Final",
      issueDate: "2026-09-01T00:00:00.000Z",
      issueDateDisplay: "1 September 2026",
      effectiveDate: "2026-09-01T00:00:00.000Z",
      effectiveDateDisplay: "1 September 2026",
      fundedPrincipal: 80_000,
    },
    investors: investors ?? [
      {
        investorOrganizationId: "org-a",
        investorReference: "IVT-A",
        investorName: "Alice Tan",
        principal: 50_000,
        sharePercent: 62.5,
        expectedGrossProfit: 1_250,
        totalPayable: 51_250,
      },
      {
        investorOrganizationId: "org-b",
        investorReference: "IVT-B",
        investorName: "Bob Lee",
        principal: 30_000,
        sharePercent: 37.5,
        expectedGrossProfit: 750,
        totalPayable: 30_750,
      },
    ],
  };
}

export function manyCertificateInvestors(count: number): CertificateSnapshotInvestor[] {
  const principalEach = Math.floor((80_000 / count) * 100) / 100;
  const leftoverPrincipal = 80_000 - principalEach * (count - 1);
  const profitEach = Math.floor((2_000 / count) * 100) / 100;
  const leftoverProfit = 2_000 - profitEach * (count - 1);
  const shareEach = Math.floor((100 / count) * 100) / 100;
  const leftoverShare = 100 - shareEach * (count - 1);
  return Array.from({ length: count }, (_, index) => {
    const last = index === count - 1;
    const principal = last ? leftoverPrincipal : principalEach;
    const expectedGrossProfit = last ? leftoverProfit : profitEach;
    return {
      investorOrganizationId: `org-${index + 1}`,
      investorReference: `IVT-${index + 1}`,
      investorName: `Investor ${index + 1}`,
      principal,
      sharePercent: last ? leftoverShare : shareEach,
      expectedGrossProfit,
      totalPayable: principal + expectedGrossProfit,
    };
  });
}
