import { PROSPECTUS_FIXED_SHARIAH_PRINCIPLE } from "@cashsouk/types";
import { buildInvestmentNoteCertificateHtml } from "./certificate-html";
import type { InvestmentNoteCertificateSnapshot } from "./types";

const snapshot: InvestmentNoteCertificateSnapshot = {
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
    repaymentProfile: "Bullet Payment at Maturity",
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
  investors: [
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

describe("buildInvestmentNoteCertificateHtml audience rules", () => {
  it("admin sees issuer legal identity and all investor names", () => {
    const html = buildInvestmentNoteCertificateHtml(snapshot, { audience: "ADMIN" });
    expect(html).toContain("IINC-NOTE-20260902-AAA");
    expect(html).toContain("IS-NOTE-20260902-AAA-V01");
    expect(html).toContain("Helios Manufacturing Sdn Bhd");
    expect(html).toContain("1234567-A");
    expect(html).toContain("Alice Tan");
    expect(html).toContain("Bob Lee");
    expect(html).toContain("IVT-A");
    expect(html).toContain("IVT-B");
    expect(html).toContain(PROSPECTUS_FIXED_SHARIAH_PRINCIPLE.replace(/'/g, "&#39;"));
  });

  it("issuer sees investor IDs but never investor names", () => {
    const html = buildInvestmentNoteCertificateHtml(snapshot, { audience: "ISSUER" });
    expect(html).toContain("Helios Manufacturing Sdn Bhd");
    expect(html).toContain("IVT-A");
    expect(html).toContain("IVT-B");
    expect(html).not.toContain("Alice Tan");
    expect(html).not.toContain("Bob Lee");
  });

  it("investor sees only self and hides issuer legal name and company no", () => {
    const html = buildInvestmentNoteCertificateHtml(snapshot, {
      audience: "INVESTOR",
      investorOrganizationId: "org-a",
    });
    expect(html).toContain("Alice Tan");
    expect(html).toContain("IVT-A");
    expect(html).not.toContain("Bob Lee");
    expect(html).not.toContain("IVT-B");
    expect(html).not.toContain("Helios Manufacturing Sdn Bhd");
    expect(html).not.toContain("1234567-A");
    expect(html).toContain("ISS-001");
  });
});
