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
  buildInvestorTakeawayVerificationRows,
  buildPageThreeMetadataRows,
  buildPageThreeOverviewRows,
  buildPageThreeTrendVerificationRows,
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

describe("page three coverage verification", () => {
  it("builds Page 3 Overview with title, DNA subtitle, and selected years", () => {
    const rows = buildPageThreeOverviewRows({
      unaudited_by_year: {
        "2022": yearRaw,
        "2023": yearRaw,
        "2024": yearRaw,
      },
    });
    expect(rows.map((r) => r.label)).toEqual([
      "Page title",
      "Subtitle",
      "Current selected financial years",
    ]);
    expect(rows.find((r) => r.label === "Page title")?.value).toBe(
      "DETAILED FINANCIAL COMPARISON"
    );
    expect(rows.find((r) => r.label === "Subtitle")?.value).toBe("Data not available");
    expect(rows.find((r) => r.label === "Current selected financial years")?.value).toBe(
      "FY2022 · FY2023 · FY2024"
    );
  });

  it("builds Metadata Strip without Issuer and with mapper-aligned fields", () => {
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
    expect(rows.find((r) => r.label === "Paymaster Grading")?.value).toBe("Data not available");
    expect(rows.find((r) => r.label === "Confidence Grading")?.value).toBe("Data not available");
    expect(rows.some((r) => /issuer/i.test(r.label))).toBe(false);
    expect(pageThreeHidesIssuerIdentity(rows)).toBe(true);
  });

  it("shows DNA risk rating when invoice offer rating is invalid", () => {
    const rows = buildPageThreeMetadataRows(
      sampleNote({
        invoiceSnapshot: { offer_details: { risk_rating: "C" } },
      })
    );
    expect(rows.find((r) => r.label === "Risk Rating")?.value).toBe("Data not available");
  });

  it("includes all seven Income Statement metrics with resolved values", () => {
    const rows = buildIncomeStatementResolvedRows(yearRaw, {
      grossProfit: 300_000,
      ebitda: 200_000,
      ebit: 180_000,
    });
    expect(rows.map((r) => r.label)).toEqual([
      "Revenue",
      "Gross Profit",
      "EBITDA",
      "EBIT",
      "Profit Before Tax",
      "Profit After Tax",
      "Net Profit Margin",
    ]);
    expect(rows.find((r) => r.label === "Revenue")?.value).toContain("1,000,000");
    expect(rows.find((r) => r.label === "Gross Profit")?.value).toContain("300,000");
    expect(rows.find((r) => r.label === "Net Profit Margin")?.value).toBe("10%");
  });

  it("includes all nine Balance Sheet & Liquidity metrics and Total Liabilities via computeTotalLiabilities", () => {
    const rows = buildBalanceSheetResolvedRows(yearRaw, {
      cashAndBank: 40_000,
      tradeReceivables: 60_000,
      totalEquity: 450_000,
      quickRatio: 1.25,
    });
    expect(rows.map((r) => r.label)).toEqual([
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
    expect(rows.find((r) => r.label === "Total Liabilities")?.value).toContain("250,000");
    expect(rows.find((r) => r.label === "Total Assets")?.value).toContain("675,000");
    expect(rows.find((r) => r.label === "Current Ratio")?.value).toMatch(/x$/);
  });

  it("includes all ten Cash Flow / Coverage / Efficiency metrics", () => {
    const rows = buildCoverageResolvedRows(yearRaw, {
      operatingCashFlow: 90_000,
      freeCashFlow: 70_000,
      interestCoverage: 4.5,
      dscr: 1.8,
      debtEquity: 0.5,
      returnOnAssets: 12,
      receivablesDays: 45,
      payablesDays: 30,
      assetTurnover: 1.2,
    });
    expect(rows.map((r) => r.label)).toEqual([
      "Operating Cash Flow",
      "Free Cash Flow",
      "Interest Coverage",
      "DSCR",
      "Debt / Equity",
      "Return on Equity",
      "Return on Assets",
      "Receivables Days",
      "Payables Days",
      "Asset Turnover",
    ]);
    expect(rows.find((r) => r.label === "Return on Equity")?.value).toBe("20%");
    expect(rows.find((r) => r.label === "Return on Assets")?.value).toBe("12");
  });

  it("exposes only the ten rendered Trend (3-Yr) outcomes, not the 26-item model", () => {
    const rows = buildPageThreeTrendVerificationRows();
    expect(PAGE_THREE_RENDERED_TREND_METRICS).toHaveLength(10);
    expect(rows).toHaveLength(10);
    expect(rows.map((r) => r.label)).toEqual([...PAGE_THREE_RENDERED_TREND_METRICS]);
    expect(rows.every((r) => r.value === "Data not available")).toBe(true);
    expect(rows.some((r) => /Revenue|Gross Profit|Cash & Bank|Current Assets/i.test(r.label))).toBe(
      false
    );
    expect(rows.some((r) => /FINANCIAL TRENDS/i.test(r.label))).toBe(false);
  });

  it("verifies six Investor Takeaway categories as resolved text without option keys", () => {
    const rows = buildInvestorTakeawayVerificationRows(
      {
        revenueProfitabilityOptionKey: "stable_growth",
        liquidityOptionKey: "do_not_display",
        leverageOptionKey: null,
        debtServicingCapacityOptionKey: "adequate",
        workingCapitalEfficiencyOptionKey: "improving",
        overallFinancialProfileOptionKey: "balanced",
      },
      {
        revenue_profitability: [{ key: "stable_growth", label: "Stable growth trajectory" }],
        liquidity: [{ key: "strong", label: "Strong liquidity" }],
        leverage: [{ key: "moderate", label: "Moderate leverage" }],
        debt_servicing_capacity: [{ key: "adequate", label: "Adequate debt service" }],
        working_capital_efficiency: [{ key: "improving", label: "Improving working capital" }],
        overall_financial_profile: [{ key: "balanced", label: "Balanced overall profile" }],
      }
    );
    expect(rows.map((r) => r.label)).toEqual([
      "Revenue and Profitability",
      "Liquidity",
      "Leverage",
      "Debt-Servicing Capacity",
      "Working-Capital Efficiency",
      "Overall Financial Profile",
    ]);
    expect(rows.find((r) => r.label === "Revenue and Profitability")?.value).toBe(
      "Stable growth trajectory"
    );
    expect(rows.find((r) => r.label === "Liquidity")?.value).toBe("Do not display");
    expect(rows.find((r) => r.label === "Leverage")?.value).toBe("Not selected");
    expect(JSON.stringify(rows)).not.toMatch(/stable_growth|optionKey/i);
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
