jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import type {
  FinancialReviewCalculatedValues,
  NoteDetail,
  ProspectusFrozenFinancialRaw,
  ProspectusFrozenFinancialYear,
} from "@cashsouk/types";
import {
  buildBalanceSheetResolvedRows,
  buildCoverageResolvedRows,
  buildIncomeStatementResolvedRows,
  buildPageThreeAdminOverviewRows,
  buildPageThreeBalanceSheetTable,
  buildPageThreeCoverageTable,
  buildPageThreeIncomeStatementTable,
  buildPageThreeMetadataRows,
  buildPageThreeOverviewRows,
  computePageThreeTotalLiabilities,
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
    sourceApplicationDisplayReference: null,
    sourceContractId: null,
    sourceContractDisplayReference: null,
    sourceInvoiceId: null,
    sourceInvoiceDisplayReference: null,
    issuerOrganizationId: "org-1",
    issuerOrganizationDisplayReference: null,
    issuerName: "Secret Issuer Sdn Bhd",
    paymasterName: "Kementerian Kerja Raya",
    riskRating: "SME-3",
    status: "DRAFT",
    listingStatus: "UNPUBLISHED",
    fundingStatus: "NOT_OPEN",
    servicingStatus: "NOT_STARTED",
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
    investorCount: 0,
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
      offer_details: { risk_rating: "SME-3" },
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

const yearRaw: ProspectusFrozenFinancialRaw = {
  turnover: 1_000_000,
  plnpbt: 120_000,
  plnpat: 100_000,
  bscatot: 400_000,
  bsfatot: 200_000,
  othass: 50_000,
  bsclbank: 25_000,
  cashAndBank: 10_000,
  tradeReceivables: 15_000,
  curlib: 150_000,
  bsslltd: 80_000,
  bsclstd: 20_000,
  bsqpuc: 500_000,
  tradePayables: 12_000,
  grossProfit: 300_000,
  ebitda: 200_000,
  netOperatingIncome: null,
  costOfSales: 680_000,
  annualDebtService: 1_000_000,
  totass: 1_000_000,
  totlib: 250_000,
  networth: 500_000,
  profit_margin: null,
  return_on_equity: null,
  currat: null,
  gear: null,
  ebit: 180_000,
  quickRatio: 1.25,
  interestCoverage: null,
  receivablesDays: null,
  payablesDays: null,
  netDebtEquity: 0.5,
  dscr: null,
  operatingCashFlow: 1_400_000,
  freeCashFlow: 1_100_000,
};

/** Stored Financial result metrics for `yearRaw` (percent metrics are percent points). */
const yearCalculated: FinancialReviewCalculatedValues = {
  totass: 1_000_000,
  totlib: 250_000,
  networth: 500_000,
  ebit: 180_000,
  turnover_growth: null,
  profit_margin: 10,
  return_on_equity: null,
  currat: null,
  quickRatio: 1.25,
  workcap: 250_000,
  roa: 10,
  assetTurnover: 1,
  gear: 0.5,
  netDebtEquity: 0.5,
  interestCoverage: null,
  receivablesDays: null,
  payablesDays: null,
  dscr: null,
};

function frozenYear(
  calendarYear: number,
  raw: ProspectusFrozenFinancialRaw = yearRaw,
  calculated: FinancialReviewCalculatedValues = yearCalculated
): ProspectusFrozenFinancialYear {
  return {
    financialYearEndIso: `${calendarYear}-12-31`,
    calendarYear,
    label: `FY${calendarYear}`,
    fyeLabel: `31 Dec ${calendarYear}`,
    sourceType: "CTOS",
    statementType: "NOT_AUDITED",
    raw: { ...raw },
    calculated: { ...calculated },
  };
}

/** One year's raw + stored calculated values for the single-year row builders. */
function yearValues(
  calculated: Partial<FinancialReviewCalculatedValues> = {},
  raw: Partial<ProspectusFrozenFinancialRaw> = {}
) {
  return {
    raw: { ...yearRaw, ...raw },
    calculated: { ...yearCalculated, ...calculated },
  };
}

const sampleFrozenYears = [
  frozenYear(2022),
  frozenYear(2023),
  frozenYear(2024, yearRaw, {
    ...yearCalculated,
    interestCoverage: 12.1,
    dscr: 1.42,
    receivablesDays: 74,
    payablesDays: 48,
  }),
];

describe("page three coverage verification", () => {
  it("builds Financial Summary with title, DNA subtitle, and selected years", () => {
    const rows = buildPageThreeOverviewRows(sampleFrozenYears);
    expect(rows.map((r) => r.label)).toEqual([
      "Page title",
      "Subtitle",
      "Financial years included",
    ]);
    expect(rows.find((r) => r.label === "Page title")?.value).toBe(
      "DETAILED FINANCIAL COMPARISON"
    );
    expect(rows.find((r) => r.label === "Subtitle")?.value).toBe("—");
    expect(rows.find((r) => r.label === "Financial years included")?.value).toBe(
      "FY2022 · FY2023 · FY2024"
    );
  });

  it("builds Financing & Risk Details without Issuer", () => {
    const rows = buildPageThreeMetadataRows(sampleNote(), {
      companySize: "Medium",
    });
    expect(rows.map((r) => r.label)).toEqual([
      "Sector",
      "Risk Rating",
      "Paymaster",
    ]);
    expect(rows.find((r) => r.label === "Sector")?.value).toBe("Construction | Medium");
    expect(rows.find((r) => r.label === "Risk Rating")?.value).toBe("SME-3");
    expect(rows.find((r) => r.label === "Paymaster")?.value).toBe("Kementerian Kerja Raya");
    expect(rows.find((r) => r.label === "Paymaster Grading")).toBeUndefined();
    expect(rows.find((r) => r.label === "Confidence Grading")).toBeUndefined();
    expect(rows.some((r) => /issuer/i.test(r.label))).toBe(false);
    expect(pageThreeHidesIssuerIdentity(rows)).toBe(true);
  });

  it("Admin overview shows Industry and Company Size separately", () => {
    const rows = buildPageThreeAdminOverviewRows(sampleNote(), {
      companySize: "Medium",
    });
    expect(rows.map((r) => r.label)).toEqual([
      "Sector",
      "Company Size",
      "Risk Rating",
      "Paymaster",
    ]);
    expect(rows.find((r) => r.label === "Sector")?.value).toBe("Construction");
    expect(rows.find((r) => r.label === "Company Size")?.value).toBe("Medium");
    expect(rows.some((r) => r.value.includes("|"))).toBe(false);
  });

  it("formats Sector with partial Industry / Company Size", () => {
    expect(
      buildPageThreeMetadataRows(sampleNote(), { companySize: null }).find(
        (r) => r.label === "Sector"
      )?.value
    ).toBe("Construction");
    expect(
      buildPageThreeMetadataRows(
        { ...sampleNote(), issuerIndustry: null, issuerSnapshot: { industry: null } },
        { companySize: "Small" }
      ).find((r) => r.label === "Sector")?.value
    ).toBe("Small");
  });

  it("does not include Paymaster Grading or Confidence Grading on Page 3 metadata rows", () => {
    const rows = buildPageThreeMetadataRows(sampleNote());
    expect(rows.find((r) => r.label === "Paymaster Grading")).toBeUndefined();
    expect(rows.find((r) => r.label === "Confidence Grading")).toBeUndefined();
    expect(rows.find((r) => r.label === "Sector")).toBeDefined();
    expect(rows.find((r) => r.label === "Risk Rating")).toBeDefined();
    expect(rows.find((r) => r.label === "Paymaster")).toBeDefined();
  });

  it("builds Income Statement as a seven-metric multi-year table", () => {
    const table = buildPageThreeIncomeStatementTable(sampleFrozenYears, {
      "2024": { grossProfit: 300_000, ebitda: 200_000, ebit: 180_000 },
    });
    expect(table.yearHeaders).toHaveLength(3);
    expect(table.rows.map((r) => r.metric)).toEqual([
      "Revenue",
      "Cost of Sales",
      "Gross Profit",
      "EBITDA",
      "EBIT",
      "Profit Before Tax",
      "Profit After Tax",
      "Net Profit Margin",
    ]);
    expect(table.rows.find((r) => r.metric === "Gross Profit")?.values[2]).toContain("300,000");
    expect(table.rows.find((r) => r.metric === "EBIT")?.values[2]).toBe("RM 180,000.00");
    expect(table.rows.find((r) => r.metric === "Net Profit Margin")?.values[2]).toBe("10%");
    expect(table.rows.every((r) => r.trend == null)).toBe(true);
  });

  it("builds Balance Sheet table with Total Liabilities from the stored value", () => {
    const table = buildPageThreeBalanceSheetTable(sampleFrozenYears, undefined);
    expect(table.rows.map((r) => r.metric)).toEqual([
      "Cash & Bank",
      "Trade Receivables",
      "Trade Payables",
      "Current Assets",
      "Total Assets",
      "Current Liabilities",
      "Total Liabilities",
      "Total Equity",
      "Current Ratio",
      "Quick Ratio",
    ]);
    expect(computePageThreeTotalLiabilities(frozenYear(2024))).toBe(250_000);
    expect(table.rows.find((r) => r.metric === "Total Liabilities")?.values[0]).toContain(
      "250,000"
    );
    expect(table.rows.find((r) => r.metric === "Total Equity")?.values[0]).toBe("RM 500,000.00");
    expect(table.rows.find((r) => r.metric === "Quick Ratio")?.values[0]).toBe("1.25x");
  });

  it("reads totals and ratios from stored calculated values, never from raw figures", () => {
    const stored = [
      frozenYear(
        2024,
        { ...yearRaw, totass: 1, totlib: 2, networth: 3, currat: 4, quickRatio: 5, ebit: 6 },
        {
          ...yearCalculated,
          totass: 999_000,
          totlib: 111_000,
          networth: 888_000,
          currat: 1.75,
          quickRatio: 0.5,
          ebit: 42_000,
        }
      ),
    ];
    const balance = buildPageThreeBalanceSheetTable(stored, undefined);
    expect(balance.rows.find((r) => r.metric === "Total Assets")?.values[0]).toBe("RM 999,000.00");
    expect(balance.rows.find((r) => r.metric === "Total Liabilities")?.values[0]).toBe(
      "RM 111,000.00"
    );
    expect(balance.rows.find((r) => r.metric === "Total Equity")?.values[0]).toBe("RM 888,000.00");
    expect(balance.rows.find((r) => r.metric === "Current Ratio")?.values[0]).toBe("1.75x");
    expect(balance.rows.find((r) => r.metric === "Quick Ratio")?.values[0]).toBe("0.5x");
    const income = buildPageThreeIncomeStatementTable(stored, undefined);
    expect(income.rows.find((r) => r.metric === "EBIT")?.values[0]).toBe("RM 42,000.00");
  });

  it("missing stored totals show — even when raw components are present", () => {
    const missing = [
      frozenYear(2024, yearRaw, { ...yearCalculated, totass: null, totlib: null, networth: null }),
    ];
    const table = buildPageThreeBalanceSheetTable(missing, undefined);
    expect(table.rows.find((r) => r.metric === "Total Assets")?.values[0]).toBe("—");
    expect(table.rows.find((r) => r.metric === "Total Liabilities")?.values[0]).toBe("—");
    expect(table.rows.find((r) => r.metric === "Total Equity")?.values[0]).toBe("—");
    expect(table.rows.find((r) => r.metric === "Current Assets")?.values[0]).toContain("400,000");
  });

  it("builds Coverage table with stored metrics and raw cash-flow rows", () => {
    const table = buildPageThreeCoverageTable(
      sampleFrozenYears,
      {
        "2024": {
          operatingCashFlow: 1_400_000,
          freeCashFlow: 1_100_000,
          payablesDays: 48,
        },
      },
      {
        "2024": {
          interestCoverage: 12.1,
          dscr: 1.42,
          receivablesDays: 74,
        },
      }
    );
    expect(table.rows.map((r) => r.metric)).toEqual([
      "Operating Cash Flow",
      "Free Cash Flow",
      "Interest Coverage",
      "Annual Debt Service",
      "DSCR",
      "Debt / Equity",
      "Return on Equity",
      "Return on Assets",
      "Receivables Days",
      "Payables Days",
      "Asset Turnover",
    ]);
    expect(table.rows).toHaveLength(11);
    expect(table.rows.every((r) => r.trend == null)).toBe(true);
    const fy2024 = 2;
    expect(table.rows.find((r) => r.metric === "Operating Cash Flow")?.values[fy2024]).toBe(
      "RM 1,400,000.00"
    );
    expect(table.rows.find((r) => r.metric === "Free Cash Flow")?.values[fy2024]).toBe(
      "RM 1,100,000.00"
    );
    expect(table.rows.find((r) => r.metric === "Interest Coverage")?.values[fy2024]).toBe(
      "12.1x"
    );
    expect(table.rows.find((r) => r.metric === "Annual Debt Service")?.values[fy2024]).toBe(
      "RM 1,000,000.00"
    );
    expect(table.rows.find((r) => r.metric === "DSCR")?.values[fy2024]).toBe("1.42x");
    expect(table.rows.find((r) => r.metric === "Return on Assets")?.values[fy2024]).toBe("10%");
    expect(table.rows.find((r) => r.metric === "Debt / Equity")?.values[fy2024]).toBe("0.5x");
    expect(table.rows.find((r) => r.metric === "Asset Turnover")?.values[fy2024]).toBe("1x");
    expect(table.rows.find((r) => r.metric === "Receivables Days")?.values[fy2024]).toBe("74");
    expect(table.rows.find((r) => r.metric === "Payables Days")?.values[fy2024]).toBe("48");
  });

  it("Debt / Equity reads stored gear, not raw gear or Net Debt / Equity", () => {
    const withGear = [
      frozenYear(2024, { ...yearRaw, gear: 9.9, netDebtEquity: 1.1 }, { ...yearCalculated, gear: 4.4 }),
    ];
    const table = buildPageThreeCoverageTable(withGear, undefined, undefined);
    expect(table.rows.find((r) => r.metric === "Debt / Equity")?.values[0]).toBe("4.4x");
  });

  it("ignores stale officer debtEquity / returnOnAssets / assetTurnover manuals", () => {
    const table = buildPageThreeCoverageTable(
      sampleFrozenYears,
      {
        "2024": {
          debtEquity: 99,
          returnOnAssets: 99,
          assetTurnover: 99,
          payablesDays: 48,
        },
      },
      undefined
    );
    const fy2024 = 2;
    expect(table.rows.find((r) => r.metric === "Debt / Equity")?.values[fy2024]).toBe("0.5x");
    expect(table.rows.find((r) => r.metric === "Return on Assets")?.values[fy2024]).toBe("10%");
    expect(table.rows.find((r) => r.metric === "Asset Turnover")?.values[fy2024]).toBe("1x");
  });

  it("ignores removed Page 3 interestCoverage / dscr / receivablesDays manuals", () => {
    const table = buildPageThreeCoverageTable(
      sampleFrozenYears,
      {
        "2024": {
          interestCoverage: 99,
          dscr: 99,
          receivablesDays: 99,
        } as Record<string, number>,
      },
      undefined
    );
    expect(table.rows.find((r) => r.metric === "Interest Coverage")?.values[0]).toBe("—");
    expect(table.rows.find((r) => r.metric === "Receivables Days")?.values[0]).toBe("—");
    expect(table.rows.find((r) => r.metric === "Interest Coverage")?.cellHints?.[0]).toBe(
      null
    );
    expect(table.rows.find((r) => r.metric === "Receivables Days")?.cellHints?.[0]).toBe(
      null
    );
  });

  it.each([
    ["Return on Assets", { roa: null }],
    ["Asset Turnover", { assetTurnover: null }],
    ["Debt / Equity", { gear: null }],
    ["Payables Days", { payablesDays: null }],
    ["DSCR", { dscr: null }],
    ["Receivables Days", { receivablesDays: null }],
    ["Interest Coverage", { interestCoverage: null }],
    ["Return on Equity", { return_on_equity: null }],
  ] as const)("renders a null stored %s as `—` (no diagnostic hints)", (label, calculated) => {
    const row = buildCoverageResolvedRows(yearValues(calculated), undefined, undefined).find(
      (r) => r.label === label
    );
    expect(row?.value).toBe("—");
    expect(row?.hint).toBeNull();
  });

  it("does not recalculate a coverage metric from raw inputs when the stored value is null", () => {
    // Every raw input for ROA / Asset Turnover / Debt/Equity / Payables Days is present.
    const rows = buildCoverageResolvedRows(
      yearValues({ roa: null, assetTurnover: null, gear: null, payablesDays: null }),
      undefined,
      undefined
    );
    for (const label of ["Return on Assets", "Asset Turnover", "Debt / Equity", "Payables Days"]) {
      expect(rows.find((r) => r.label === label)?.value).toBe("—");
    }
  });

  it("keeps single-year resolved helpers for Total Liabilities parity", () => {
    const rows = buildBalanceSheetResolvedRows(yearValues(), { quickRatio: 1.25 });
    expect(rows.find((r) => r.label === "Total Liabilities")?.value).toContain("250,000");
    expect(buildIncomeStatementResolvedRows(yearValues(), undefined)).toHaveLength(8);
    expect(buildCoverageResolvedRows(yearValues(), undefined, undefined)).toHaveLength(11);
  });

  it("ROE reads the stored percent points (not × 100) and ignores raw return_on_equity", () => {
    const rows = buildCoverageResolvedRows(
      yearValues({ return_on_equity: 15.2 }, { return_on_equity: 99 }),
      undefined,
      undefined
    );
    expect(rows.find((r) => r.label === "Return on Equity")?.value).toBe("15.2%");
  });

  it("Current Ratio reads the stored currat and ignores raw currat", () => {
    const withValue = buildBalanceSheetResolvedRows(
      yearValues({ currat: 1.75 }, { currat: 9 }),
      undefined
    );
    expect(withValue.find((r) => r.label === "Current Ratio")?.value).toBe("1.75x");

    const missing = buildBalanceSheetResolvedRows(
      yearValues({ currat: null }, { currat: 9, bscatot: 400_000, curlib: 200_000 }),
      undefined
    );
    const currentRatioMissing = missing.find((r) => r.label === "Current Ratio");
    expect(currentRatioMissing?.value).toBe("—");
    expect(currentRatioMissing?.hint).toBeNull();
  });

  it("Net Profit Margin and EBIT read stored values without diagnostic hints", () => {
    const rows = buildIncomeStatementResolvedRows(
      yearValues({ ebit: null, profit_margin: 12.5 }, { ebit: 180_000 }),
      undefined
    );
    expect(rows.find((r) => r.label === "EBIT")?.value).toBe("—");
    expect(rows.find((r) => r.label === "EBIT")?.hint).toBeNull();
    expect(rows.find((r) => r.label === "Net Profit Margin")?.value).toBe("12.5%");
  });

  it("uses frozen year order without independent Application selection", () => {
    expect(selectPageThreeYears(sampleFrozenYears)).toEqual(["2022", "2023", "2024"]);
    expect(selectPageThreeYears([frozenYear(2021), frozenYear(2023)])).toEqual([
      "2021",
      "2023",
    ]);
  });

  it("keeps year columns when officer manuals are missing", () => {
    const table = buildPageThreeIncomeStatementTable(sampleFrozenYears, {});
    expect(table.yearHeaders).toHaveLength(3);
    expect(table.yearHeaders.map((h) => h.key)).toEqual([
      "2022-12-31",
      "2023-12-31",
      "2024-12-31",
    ]);
    expect(table.rows.find((r) => r.metric === "Gross Profit")?.values).toEqual([
      "RM 300,000.00",
      "RM 300,000.00",
      "RM 300,000.00",
    ]);
  });

  it("renders display placeholder years as — without using officer manuals or stored values", () => {
    const years = [
      { ...frozenYear(2024), isPlaceholder: true },
      frozenYear(2025),
      frozenYear(2026),
    ];
    const manuals = {
      "2024": { grossProfit: 999 },
      "2025": { grossProfit: 10 },
      "2026": { grossProfit: 20 },
    };
    const income = buildPageThreeIncomeStatementTable(years, manuals);
    expect(income.yearHeaders.map((h) => h.yearLabel)).toEqual([
      "FY2024",
      "FY2025",
      "FY2026",
    ]);
    expect(income.yearHeaders[0]?.isPlaceholder).toBe(true);
    for (const table of [
      income,
      buildPageThreeBalanceSheetTable(years, undefined),
      buildPageThreeCoverageTable(years, undefined),
    ]) {
      for (const row of table.rows) expect(row.values[0]).toBe("—");
    }
  });

  it("does not render diagnostic helper text in Prospectus tables", () => {
    const income = buildPageThreeIncomeStatementTable(sampleFrozenYears, undefined);
    const balance = buildPageThreeBalanceSheetTable(sampleFrozenYears, undefined);
    const coverage = buildPageThreeCoverageTable(sampleFrozenYears, undefined);

    const forbidden = [
      "Cannot calculate",
      "Missing: ",
      "Missing financial inputs",
      "Invalid: ",
      "Missing: Return on Equity",
      "Missing: Current Ratio",
      "Missing: Net Debt / Equity",
      "Missing: DSCR",
      "Missing: Interest Coverage",
      "Missing: Asset Turnover",
      "Missing: Return on Assets",
      "Missing: Payables Days",
    ] as const;

    const serialized = JSON.stringify({ income, balance, coverage });
    for (const s of forbidden) expect(serialized).not.toContain(s);
  });

  it("Income, Balance, and Coverage share the same frozen year headers", () => {
    const income = buildPageThreeIncomeStatementTable(sampleFrozenYears, undefined);
    const balance = buildPageThreeBalanceSheetTable(sampleFrozenYears, undefined);
    const coverage = buildPageThreeCoverageTable(sampleFrozenYears, undefined);
    expect(balance.yearHeaders).toEqual(income.yearHeaders);
    expect(coverage.yearHeaders).toEqual(income.yearHeaders);
  });
});
