jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import type { NoteDetail } from "@cashsouk/types";
import {
  buildInvoicePaymasterVerificationRows,
  buildPageTwoFinancialComparisonTable,
  pageTwoCoverageHidesIssuerIdentity,
  parseInvoiceSnapshotFaceValue,
} from "./page-two-coverage";

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
    riskRating: "B",
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
  it("legacy helper mirrors API Invoice & Paymaster labels (Admin uses invoicePaymaster.rows)", () => {
    const rows = buildInvoicePaymasterVerificationRows(sampleNote());
    expect(rows.map((r) => r.label)).toEqual([
      "Invoice Amount",
      "Invoice Due Date",
      "Paymaster",
      "Nature of Paymaster",
      "Deed of Assignment (DOA)",
      "Paymaster Rating",
      "Confidence Grading",
    ]);
    expect(rows.find((r) => r.label === "Invoice Amount")?.value).toContain("625,000");
    expect(rows.find((r) => r.label === "Invoice Amount")?.value).not.toContain("999");
    expect(rows.find((r) => r.label === "Paymaster")?.value).toBe("Kementerian Kerja Raya");
    expect(rows.find((r) => r.label === "Nature of Paymaster")?.value).toBe(
      "Government Ministry"
    );
    expect(rows.find((r) => r.label === "Deed of Assignment (DOA)")?.value).toBe(
      "—"
    );
    expect(rows.find((r) => r.label === "Paymaster Rating")?.value).toBe("—");
    expect(rows.find((r) => r.label === "Confidence Grading")?.value).toBe("—");
  });

  it("parses invoice face value only from invoice_snapshot.details.value", () => {
    expect(parseInvoiceSnapshotFaceValue({ details: { value: 100 } })).toBe(100);
    expect(parseInvoiceSnapshotFaceValue({ invoiceAmount: 200 })).toBeNull();
  });

  it("keeps issuer identity out of investor-visible issuer profile and invoice rows", () => {
    // Same labels Admin receives from API issuerProfile.rows + invoicePaymaster.rows.
    const issuer = [
      { label: "Industry", value: "Construction" },
      { label: "Company Size", value: "Medium" },
      { label: "Registered Country", value: "Registered in Malaysia" },
      { label: "Business Description", value: "Infrastructure works" },
    ];
    const invoice = buildInvoicePaymasterVerificationRows(sampleNote());
    expect(issuer.map((r) => r.label)).toEqual([
      "Industry",
      "Company Size",
      "Registered Country",
      "Business Description",
    ]);
    expect(pageTwoCoverageHidesIssuerIdentity([...issuer, ...invoice])).toBe(true);
    expect(issuer.some((r) => r.value.includes("Secret Issuer"))).toBe(false);
    expect(issuer.some((r) => r.value.includes("1234567-A"))).toBe(false);
    expect(issuer.some((r) => r.label === "Entity Type")).toBe(false);
    expect(invoice.some((r) => String(r.value).includes("Secret Issuer"))).toBe(false);
    expect(sampleNote().issuerName).toBe("Secret Issuer Sdn Bhd");
  });

  it("builds 3-Year Financial Comparison as a nine-metric table", () => {
    const table = buildPageTwoFinancialComparisonTable({
      questionnaire: { financial_year_end: "2024-12-31" },
      unaudited_by_year: {
        "2023": { turnover: 1000, plnpat: 100, bsqpuc: 500, bscatot: 200, curlib: 100 },
        "2024": { turnover: 2000, plnpat: 200, bsqpuc: 800, bscatot: 400, curlib: 200 },
      },
    });
    expect(table.yearHeaders.map((h) => h.yearLabel)).toEqual(["FY2023", "FY2024"]);
    expect(table.rows.map((r) => r.metric)).toEqual([
      "Revenue",
      "Profit After Tax (RM mil.)",
      "Net Profit Margin (%)",
      "ROE (%)",
      "Current Ratio (x)",
      "Net Debt / Equity (x)",
      "Interest Coverage (x)",
      "DSCR (x)",
      "Receivables Days",
    ]);
    expect(table.rows.find((r) => r.metric === "Revenue")?.values[0]).toContain("1,000");
    expect(
      table.rows
        .find((r) => r.metric === "Net Debt / Equity (x)")
        ?.values.every((v) => v === "—")
    ).toBe(true);
    expect(table.rows.every((r) => r.trend == null)).toBe(true);
  });
});
