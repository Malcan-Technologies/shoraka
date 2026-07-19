jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import type { NoteDetail } from "@cashsouk/types";
import {
  buildInvestmentCtaVerificationRows,
  buildInvoicePaymasterVerificationRows,
  buildPageTwoFinancialComparisonRows,
  buildRiskScaleVerificationRows,
  pageTwoCoverageHidesIssuerIdentity,
  parseInvoiceSnapshotFaceValue,
} from "./page-two-coverage";
import { buildIssuerProfileRows } from "./core-terms";

function sampleNote(overrides: Partial<NoteDetail> = {}): NoteDetail {
  return {
    id: "note-1",
    noteReference: "PROSPECTUS-DEMO-001",
    title: "Demo",
    productCategory: null,
    productName: null,
    issuerIndustry: "Construction",
    sourceApplicationId: "app-1",
    sourceContractId: null,
    sourceInvoiceId: null,
    issuerOrganizationId: "org-1",
    issuerName: "Secret Issuer Sdn Bhd",
    paymasterName: "Kementerian Kerja Raya",
    riskRating: "AA",
    status: "DRAFT",
    listingStatus: "UNPUBLISHED",
    fundingStatus: "NOT_OPEN",
    servicingStatus: "NOT_STARTED",
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
    maturityDate: "2026-12-31T00:00:00.000Z",
    listingClosesAt: null,
    activatedAt: null,
    publishedAt: null,
    settlementSummary: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    targetAmount: 500_000,
    fundedAmount: 0,
    fundingPercent: 0,
    minimumFundingPercent: 0,
    requestedAmount: 500_000,
    invoiceAmount: 999_999,
    settlementAmount: 0,
    profitRatePercent: 10,
    platformFeeRatePercent: 0,
    serviceFeeRatePercent: 20,
    productSnapshot: null,
    purposeSnapshot: null,
    prospectusSnapshot: null,
    issuerSnapshot: {
      industry: "Construction",
      entity_type: "Sdn Bhd",
      country: "Malaysia",
      business_description: "Infrastructure contractor",
      name: "Secret Issuer Sdn Bhd",
      registration_number: "1234567-A",
    },
    paymasterSnapshot: {
      name: "Kementerian Kerja Raya",
      entity_type: "Government Ministry",
    },
    contractSnapshot: null,
    invoiceSnapshot: {
      details: { value: 625_000 },
    },
    serviceFeeCustomerScope: null,
    gracePeriodDays: 0,
    arrearsThresholdDays: 0,
    tawidhRateCapPercent: 0,
    gharamahRateCapPercent: 0,
    defaultMarkedAt: null,
    defaultReason: null,
    listing: null,
    investments: [],
    paymentSchedules: [],
    payments: [],
    settlements: [],
    withdrawals: [],
    events: [],
    ...overrides,
  } as NoteDetail;
}

describe("page two coverage verification", () => {
  it("builds Invoice & Paymaster Information from Page 2 mapper sources", () => {
    const rows = buildInvoicePaymasterVerificationRows(sampleNote());
    expect(rows.map((r) => r.label)).toEqual([
      "Invoice Amount",
      "Invoice Due Date",
      "Paymaster",
      "Nature of Paymaster",
      "Deed of Assignment",
      "Paymaster Rating",
      "Confidence Grading",
    ]);
    expect(rows.find((r) => r.label === "Invoice Amount")?.value).toContain("625,000");
    expect(rows.find((r) => r.label === "Invoice Amount")?.value).not.toContain("999");
    expect(rows.find((r) => r.label === "Paymaster")?.value).toBe("Kementerian Kerja Raya");
    expect(rows.find((r) => r.label === "Nature of Paymaster")?.value).toBe(
      "Government Ministry"
    );
    expect(rows.find((r) => r.label === "Deed of Assignment")?.value).toBe("Data not available");
    expect(rows.find((r) => r.label === "Paymaster Rating")?.value).toBe("Data not available");
    expect(rows.find((r) => r.label === "Confidence Grading")?.value).toBe("Data not available");
  });

  it("parses invoice face value only from invoice_snapshot.details.value", () => {
    expect(parseInvoiceSnapshotFaceValue({ details: { value: 100 } })).toBe(100);
    expect(parseInvoiceSnapshotFaceValue({ invoiceAmount: 200 })).toBeNull();
  });

  it("keeps issuer identity out of issuer and invoice verification rows", () => {
    const issuer = buildIssuerProfileRows(sampleNote());
    const invoice = buildInvoicePaymasterVerificationRows(sampleNote());
    expect(issuer.map((r) => r.label)).toEqual([
      "Industry",
      "Entity Type",
      "Company Size",
      "Registered Country",
      "Business Description",
    ]);
    expect(pageTwoCoverageHidesIssuerIdentity([...issuer, ...invoice])).toBe(true);
    expect(issuer.some((r) => r.value.includes("Secret Issuer"))).toBe(false);
    expect(issuer.some((r) => r.value.includes("1234567-A"))).toBe(false);
  });

  it("builds financial comparison metric verification without inventing DNA rows", () => {
    const rows = buildPageTwoFinancialComparisonRows({
      unaudited_by_year: {
        "2023": { turnover: 1000, plnpat: 100, bsqpuc: 500, bscatot: 200, curlib: 100 },
        "2024": { turnover: 2000, plnpat: 200, bsqpuc: 800, bscatot: 400, curlib: 200 },
      },
    });
    expect(rows.find((r) => r.label === "Revenue")?.value).toContain("FY2023");
    expect(rows.find((r) => r.label === "Revenue")?.value).toContain("FY2024");
    expect(rows.find((r) => r.label === "Debt / Equity")?.value).toContain("Data not available");
    expect(rows.find((r) => r.label === "Full comparison table")?.value).toMatch(/Page 2 Preview/i);
  });

  it("builds read-only risk scale and CTA verification", () => {
    const risk = buildRiskScaleVerificationRows(sampleNote());
    expect(risk.find((r) => r.label === "Current selected rating")?.value).toBe("AA");
    expect(risk.find((r) => r.label === "Risk Rating Scale")?.value).toMatch(/SoukScore/i);

    const cta = buildInvestmentCtaVerificationRows();
    expect(cta.find((r) => r.label === "CTA heading")?.value).toBe("INVEST WITH CONFIDENCE");
    expect(cta.find((r) => r.label === "CTA button")?.value).toBe("INVEST NOW");
    expect(cta.find((r) => r.label === "CTA wording")?.value).toBe("Data not available");
    expect(cta.find((r) => r.label === "Minimum investment")?.value).toMatch(/Minimum investment:/);
  });
});
