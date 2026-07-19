jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import { computeTotalLiabilities, type NoteDetail } from "@cashsouk/types";
import {
  buildBalanceSheetResolvedRows,
  buildCoverageResolvedRows,
  buildIncomeStatementResolvedRows,
  buildPageThreeBalanceSheetTable,
  buildPageThreeCoverageTable,
  buildPageThreeIncomeStatementTable,
  buildPageThreeMetadataRows,
  buildPageThreeOverviewRows,
  computePageThreeTotalLiabilities,
  PAGE_THREE_RENDERED_TREND_METRICS,
  pageThreeHidesIssuerIdentity,
  selectPageThreeYears,
} from "./page-three-coverage";

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
      offer_details: { risk_rating: "AA" },
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

const yearRaw = {
  turnover: 1_000_000,
  plnpbt: 120_000,
  plnpat: 100_000,
  bscatot: 400_000,
  bsfatot: 200_000,
  othass: 50_000,
  bsclbank: 25_000,
  curlib: 150_000,
  bsslltd: 80_000,
  bsclstd: 20_000,
  bsqpuc: 500_000,
};

const sampleStatements = {
  questionnaire: { financial_year_end: "2024-12-31" },
  unaudited_by_year: {
    "2022": yearRaw,
    "2023": yearRaw,
    "2024": yearRaw,
  },
};

describe("page three coverage verification", () => {
  it("builds Financial Summary with title, DNA subtitle, and selected years", () => {
    const rows = buildPageThreeOverviewRows(sampleStatements);
    expect(rows.map((r) => r.label)).toEqual([
      "Page title",
      "Subtitle",
      "Financial years included",
    ]);
    expect(rows.find((r) => r.label === "Page title")?.value).toBe(
      "DETAILED FINANCIAL COMPARISON"
    );
    expect(rows.find((r) => r.label === "Subtitle")?.value).toBe("Data not available");
    expect(rows.find((r) => r.label === "Financial years included")?.value).toBe(
      "FY2022 · FY2023 · FY2024"
    );
  });

  it("builds Financing & Risk Details without Issuer", () => {
    const rows = buildPageThreeMetadataRows(sampleNote());
    expect(rows.map((r) => r.label)).toEqual([
      "Sector",
      "Risk Rating",
      "Paymaster",
      "Paymaster Grading",
      "Confidence Grading",
    ]);
    expect(rows.find((r) => r.label === "Sector")?.value).toBe("Construction");
    expect(rows.find((r) => r.label === "Risk Rating")?.value).toBe("AA");
    expect(rows.find((r) => r.label === "Paymaster")?.value).toBe("Kementerian Kerja Raya");
    expect(rows.some((r) => /issuer/i.test(r.label))).toBe(false);
    expect(pageThreeHidesIssuerIdentity(rows)).toBe(true);
  });

  it("builds Income Statement as a seven-metric multi-year table", () => {
    const table = buildPageThreeIncomeStatementTable(sampleStatements, {
      "2024": { grossProfit: 300_000, ebitda: 200_000, ebit: 180_000 },
    });
    expect(table.yearHeaders).toHaveLength(3);
    expect(table.rows.map((r) => r.metric)).toEqual([
      "Revenue",
      "Gross Profit",
      "EBITDA",
      "EBIT",
      "Profit Before Tax",
      "Profit After Tax",
      "Net Profit Margin",
    ]);
    expect(table.rows.find((r) => r.metric === "Gross Profit")?.values[2]).toContain("300,000");
    expect(table.rows.every((r) => r.trend == null)).toBe(true);
  });

  it("builds Balance Sheet table with Total Liabilities via computeTotalLiabilities", () => {
    const table = buildPageThreeBalanceSheetTable(sampleStatements, undefined);
    expect(table.rows.map((r) => r.metric)).toEqual([
      "Cash & Bank",
      "Trade Receivables",
      "Current Assets",
      "Total Assets",
      "Current Liabilities",
      "Total Liabilities",
      "Total Equity",
      "Current Ratio",
      "Quick Ratio",
    ]);
    const expected = computeTotalLiabilities({
      total_liabilities: null,
      current_liabilities: 150_000,
      long_term_liabilities: 80_000,
      non_current_liabilities: 20_000,
    });
    expect(computePageThreeTotalLiabilities(yearRaw)).toBe(expected);
    expect(table.rows.find((r) => r.metric === "Total Liabilities")?.values[0]).toContain(
      "250,000"
    );
  });

  it("builds Coverage table with ten metrics and DNA trend column only", () => {
    const table = buildPageThreeCoverageTable(sampleStatements, {
      "2024": {
        operatingCashFlow: 90_000,
        freeCashFlow: 70_000,
        interestCoverage: 4.5,
        dscr: 1.8,
        debtEquity: 0.5,
        returnOnAssets: 12,
        receivablesDays: 45,
        payablesDays: 30,
        assetTurnover: 1.2,
      },
    });
    expect(table.rows.map((r) => r.metric)).toEqual([...PAGE_THREE_RENDERED_TREND_METRICS]);
    expect(table.rows).toHaveLength(10);
    expect(table.rows.every((r) => r.trend === "Data not available")).toBe(true);
    expect(table.rows.some((r) => /Revenue|Gross Profit|Cash & Bank/i.test(r.metric))).toBe(
      false
    );
  });

  it("keeps single-year resolved helpers for Total Liabilities parity", () => {
    const rows = buildBalanceSheetResolvedRows(yearRaw, { quickRatio: 1.25 });
    expect(rows.find((r) => r.label === "Total Liabilities")?.value).toContain("250,000");
    expect(buildIncomeStatementResolvedRows(yearRaw, undefined)).toHaveLength(7);
    expect(buildCoverageResolvedRows(yearRaw, undefined)).toHaveLength(10);
  });

  it("selects at most three financial years ascending for Page 3", () => {
    expect(
      selectPageThreeYears({
        unaudited_by_year: {
          "2020": {},
          "2021": {},
          "2022": {},
          "2023": {},
          "2024": {},
        },
      })
    ).toEqual(["2022", "2023", "2024"]);
  });
});
