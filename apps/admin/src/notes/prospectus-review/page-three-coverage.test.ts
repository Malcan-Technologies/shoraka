jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import {
  resolveCtosTotalLiabilities,
  type NoteDetail,
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

const yearRaw: import("@cashsouk/types").ProspectusFrozenFinancialRaw = {
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

function frozenYear(
  calendarYear: number,
  raw: import("@cashsouk/types").ProspectusFrozenFinancialRaw = yearRaw
): import("@cashsouk/types").ProspectusFrozenFinancialYear {
  return {
    financialYearEndIso: `${calendarYear}-12-31`,
    calendarYear,
    label: `FY${calendarYear}`,
    fyeLabel: `31 Dec ${calendarYear}`,
    sourceType: "CTOS",
    statementType: "NOT_AUDITED",
    raw: { ...raw },
  };
}

const sampleFrozenYears = [
  frozenYear(2022),
  frozenYear(2023),
  frozenYear(2024, {
    ...yearRaw,
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
    expect(table.rows.every((r) => r.trend == null)).toBe(true);
  });

  it("builds Balance Sheet table with Total Liabilities from direct totlib only", () => {
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
    expect(computePageThreeTotalLiabilities({ ...yearRaw })).toBe(
      resolveCtosTotalLiabilities({ totlib: yearRaw.totlib })
    );
    expect(table.rows.find((r) => r.metric === "Total Liabilities")?.values[0]).toContain(
      "250,000"
    );
  });

  it("does not reconstruct Total Assets / Liabilities from components when flat totals missing", () => {
    const incomplete = [
      frozenYear(2024, {
        turnover: null,
        plnpbt: null,
        plnpat: null,
        grossProfit: null,
        ebitda: null,
        netOperatingIncome: null,
        ebit: null,
        bscatot: 400_000,
        bsfatot: null,
        othass: null,
        bsclbank: null,
        cashAndBank: null,
        tradeReceivables: null,
        curlib: 150_000,
        bsslltd: null,
        bsclstd: null,
        tradePayables: null,
        bsqpuc: null,
        costOfSales: null,
        annualDebtService: null,
        totass: null,
        totlib: null,
        networth: null,
        profit_margin: null,
        return_on_equity: null,
        currat: null,
        gear: null,
        quickRatio: null,
        interestCoverage: null,
        receivablesDays: null,
        payablesDays: null,
        netDebtEquity: null,
        dscr: null,
        operatingCashFlow: null,
        freeCashFlow: null,
      }),
    ];
    const table = buildPageThreeBalanceSheetTable(incomplete, undefined);
    expect(table.rows.find((r) => r.metric === "Total Assets")?.values[0]).toBe("Cannot calculate");
    expect(table.rows.find((r) => r.metric === "Current Assets")?.values[0]).toContain(
      "400,000"
    );
    expect(table.rows.find((r) => r.metric === "Total Liabilities")?.values[0]).toBe("Cannot calculate");
  });

  it("prefers flat totass / totlib when present; missing flat totals show —", () => {
    const withFlat = [frozenYear(2024, { ...yearRaw, totass: 999_000, totlib: 111_000 })];
    const table = buildPageThreeBalanceSheetTable(withFlat, undefined);
    expect(table.rows.find((r) => r.metric === "Total Assets")?.values[0]).toContain(
      "999,000"
    );
    expect(table.rows.find((r) => r.metric === "Total Liabilities")?.values[0]).toContain(
      "111,000"
    );

    const missingFlat = [
      frozenYear(2024, {
        ...yearRaw,
        totass: null,
        totlib: null,
        bsfatot: 200_000,
        othass: 50_000,
        bscatot: 400_000,
        bsclbank: 25_000,
        curlib: 150_000,
        bsslltd: 80_000,
        bsclstd: 20_000,
      }),
    ];
    const dna = buildPageThreeBalanceSheetTable(missingFlat, undefined);
    expect(dna.rows.find((r) => r.metric === "Total Assets")?.values[0]).toBe("Cannot calculate");
    expect(dna.rows.find((r) => r.metric === "Total Liabilities")?.values[0]).toBe("Cannot calculate");
  });

  it("builds Coverage table with Page 2 reuse, CTOS system rows, and DNA trend", () => {
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
    // CTOS ENQWS v5.11.0: plnpat/totass*100 = 100000/1000000*100 = 10
    expect(table.rows.find((r) => r.metric === "Return on Assets")?.values[fy2024]).toBe("10%");
    // CTOS: totlib/networth = 250000/500000 = 0.5x (no gear)
    expect(table.rows.find((r) => r.metric === "Debt / Equity")?.values[fy2024]).toBe("0.5x");
    // CTOS: turnover/totass = 1x
    expect(table.rows.find((r) => r.metric === "Asset Turnover")?.values[fy2024]).toBe("1x");
    expect(table.rows.find((r) => r.metric === "Receivables Days")?.values[fy2024]).toBe("74");
    expect(table.rows.find((r) => r.metric === "Payables Days")?.values[fy2024]).toBe("48");
  });

  it("prefers official CTOS gear for Debt / Equity when present", () => {
    // netDebtEquity is an unrelated metric; Debt / Equity must follow CTOS gear.
    const withGear = [frozenYear(2024, { ...yearRaw, gear: 4.4, netDebtEquity: 1.1 })];
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
    expect(table.rows.find((r) => r.metric === "Interest Coverage")?.values[0]).toBe("Cannot calculate");
    expect(table.rows.find((r) => r.metric === "Receivables Days")?.values[0]).toBe("Cannot calculate");
    expect(table.rows.find((r) => r.metric === "Interest Coverage")?.cellHints?.[0]).toBe(
      "Missing: Interest Costs"
    );
    expect(table.rows.find((r) => r.metric === "Receivables Days")?.cellHints?.[0]).toBe(
      "Missing: previous financial year Trade Receivables"
    );
  });

  it("adds dependency-aware hints for calculated DNA metrics on Page 3", () => {
    const dnaRoa = buildCoverageResolvedRows(
      { ...yearRaw, plnpat: null },
      undefined,
      undefined
    ).find((r) => r.label === "Return on Assets");
    expect(dnaRoa?.value).toBe("Cannot calculate");
    expect(dnaRoa?.hint).toBe("Missing: Profit / Loss After Tax");

    const dnaRoaTotAssets = buildCoverageResolvedRows(
      { ...yearRaw, totass: null },
      undefined,
      undefined
    ).find((r) => r.label === "Return on Assets");
    expect(dnaRoaTotAssets?.value).toBe("Cannot calculate");
    expect(dnaRoaTotAssets?.hint).toBe("Missing: Total Assets");

    const dnaAssetTurnoverMissingRevenue = buildCoverageResolvedRows(
      { ...yearRaw, turnover: null },
      undefined,
      undefined
    ).find((r) => r.label === "Asset Turnover");
    expect(dnaAssetTurnoverMissingRevenue?.value).toBe("Cannot calculate");
    expect(dnaAssetTurnoverMissingRevenue?.hint).toBe("Missing: Revenue / Turnover");

    const dnaAssetTurnoverMissingAssets = buildCoverageResolvedRows(
      { ...yearRaw, totass: null },
      undefined,
      undefined
    ).find((r) => r.label === "Asset Turnover");
    expect(dnaAssetTurnoverMissingAssets?.value).toBe("Cannot calculate");
    expect(dnaAssetTurnoverMissingAssets?.hint).toBe("Missing: Total Assets");

    const dnaDebtEqMissingLiabilities = buildCoverageResolvedRows(
      { ...yearRaw, totlib: null },
      undefined,
      undefined
    ).find((r) => r.label === "Debt / Equity");
    expect(dnaDebtEqMissingLiabilities?.value).toBe("Cannot calculate");
    expect(dnaDebtEqMissingLiabilities?.hint).toBe("Missing: Total Liabilities");

    const dnaPayablesMissingCost = buildCoverageResolvedRows(
      { ...yearRaw, costOfSales: null },
      undefined,
      undefined
    ).find((r) => r.label === "Payables Days");
    expect(dnaPayablesMissingCost?.value).toBe("Cannot calculate");
    expect(dnaPayablesMissingCost?.hint).toBe("Missing: Cost of Sales");

    const dnaDscrMissingNoi = buildCoverageResolvedRows(
      { ...yearRaw, netOperatingIncome: null, dscr: null },
      undefined,
      undefined
    ).find((r) => r.label === "DSCR");
    expect(dnaDscrMissingNoi?.value).toBe("Cannot calculate");
    expect(dnaDscrMissingNoi?.hint).toBe("Missing: Net Operating Income");

    const dnaReceivablesMissingEndingTradeReceivables = buildCoverageResolvedRows(
      { ...yearRaw, tradeReceivables: null, receivablesDays: null },
      undefined,
      { tradeReceivables: 14_000 } as Record<string, unknown>
    ).find((r) => r.label === "Receivables Days");
    expect(dnaReceivablesMissingEndingTradeReceivables?.value).toBe("Cannot calculate");
    expect(dnaReceivablesMissingEndingTradeReceivables?.hint).toBe("Missing: Trade Receivables");
  });

  it("Payables Days: dependency-aware missing hints (frozen raw)", () => {
    const missingTradePayables = buildCoverageResolvedRows(
      { ...yearRaw, tradePayables: null },
      undefined,
      undefined
    ).find((r) => r.label === "Payables Days");
    expect(missingTradePayables?.value).toBe("Cannot calculate");
    expect(missingTradePayables?.hint).toBe("Missing: Trade Payables");

    const missingCostOfSales = buildCoverageResolvedRows(
      { ...yearRaw, costOfSales: null },
      undefined,
      undefined
    ).find((r) => r.label === "Payables Days");
    expect(missingCostOfSales?.value).toBe("Cannot calculate");
    expect(missingCostOfSales?.hint).toBe("Missing: Cost of Sales");

    const invalidZeroDenominator = buildCoverageResolvedRows(
      { ...yearRaw, costOfSales: 0 },
      undefined,
      undefined
    ).find((r) => r.label === "Payables Days");
    expect(invalidZeroDenominator?.value).toBe("Cannot calculate");
    expect(invalidZeroDenominator?.hint).toBe("Invalid: Cost of Sales is zero");
  });

  it("keeps single-year resolved helpers for Total Liabilities parity", () => {
    const rows = buildBalanceSheetResolvedRows({ ...yearRaw }, { quickRatio: 1.25 });
    expect(rows.find((r) => r.label === "Total Liabilities")?.value).toContain("250,000");
    expect(buildIncomeStatementResolvedRows({ ...yearRaw }, undefined)).toHaveLength(8);
    expect(buildCoverageResolvedRows({ ...yearRaw }, undefined, undefined)).toHaveLength(11);
  });

  it("uses direct CTOS return_on_equity only for ROE (no PAT/networth fallback)", () => {
    const rows = buildCoverageResolvedRows(
      { ...yearRaw, return_on_equity: 15.2, plnpat: 1, bsqpuc: 100 },
      undefined,
      undefined
    );
    expect(rows.find((r) => r.label === "Return on Equity")?.value).toBe("15.2%");

    const missingFlat = buildCoverageResolvedRows(
      {
        ...yearRaw,
        return_on_equity: null,
        plnpat: 100_000,
        networth: 500_000,
        totass: 1_000_000,
        totlib: 250_000,
      },
      undefined,
      undefined
    );
    const missingRoe = missingFlat.find((r) => r.label === "Return on Equity");
    expect(missingRoe?.value).toBe("Cannot calculate");
    expect(missingRoe?.hint).toBe("Missing required financial inputs");
  });

  it("uses direct CTOS currat only for Current Ratio (no CA÷CL fallback)", () => {
    const withFlat = buildBalanceSheetResolvedRows(
      { ...yearRaw, currat: 1.75, bscatot: 400_000, curlib: 150_000 },
      undefined
    );
    expect(withFlat.find((r) => r.label === "Current Ratio")?.value).toBe("1.75x");

    const missingCurrat = buildBalanceSheetResolvedRows(
      { ...yearRaw, currat: null, bscatot: 400_000, curlib: 200_000 },
      undefined
    );
    const currentRatioMissing = missingCurrat.find((r) => r.label === "Current Ratio");
    expect(currentRatioMissing?.value).toBe("Cannot calculate");
    expect(currentRatioMissing?.hint).toBe("Missing required financial inputs");
  });

  it("builds EBIT helper text from dependency presence (PBT + Interest Costs)", () => {
    // PBT exists -> missing Interest Costs.
    const missingInterestCosts = buildIncomeStatementResolvedRows(
      { ...yearRaw, ebit: null, plnpbt: 120_000, plnpat: 100_000 },
      undefined
    );
    expect(missingInterestCosts.find((r) => r.label === "EBIT")?.hint).toBe(
      "Missing: Interest Costs"
    );

    // Interest Costs exists -> missing PBT (PBT missing but PAT still exists).
    const missingPbt = buildIncomeStatementResolvedRows(
      { ...yearRaw, ebit: null, plnpbt: null, interest_cost: 25_000, plnpat: 100_000 },
      undefined
    );
    expect(missingPbt.find((r) => r.label === "EBIT")?.hint).toBe(
      "Missing: Profit / Loss Before Tax"
    );

    // Both missing -> required financial inputs.
    const missingBoth = buildIncomeStatementResolvedRows(
      { ...yearRaw, ebit: null, plnpbt: null, plnpat: null },
      undefined
    );
    expect(missingBoth.find((r) => r.label === "EBIT")?.hint).toBe(
      "Missing required financial inputs"
    );
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

  it("renders display placeholder years as — without using officer manuals", () => {
    const empty: import("@cashsouk/types").ProspectusFrozenFinancialRaw = {
      turnover: null,
      plnpbt: null,
      plnpat: null,
      grossProfit: null,
      ebitda: null,
      netOperatingIncome: null,
      ebit: null,
      bscatot: null,
      bsfatot: null,
      othass: null,
      bsclbank: null,
      cashAndBank: null,
      costOfSales: null,
      curlib: null,
      bsslltd: null,
      bsclstd: null,
      bsqpuc: null,
      tradeReceivables: null,
      tradePayables: null,
      receivablesDays: null,
      payablesDays: null,
      totass: null,
      totlib: null,
      networth: null,
      profit_margin: null,
      return_on_equity: null,
      currat: null,
      gear: null,
      quickRatio: null,
      annualDebtService: null,
      interestCoverage: null,
      netDebtEquity: null,
      dscr: null,
      operatingCashFlow: null,
      freeCashFlow: null,
    };
    const years = [
      { ...frozenYear(2024, empty), isPlaceholder: true },
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
    const gp = income.rows.find((r) => r.metric === "Gross Profit");
    expect(gp?.values[0]).toBe("—");
  });

  it("Income, Balance, and Coverage share the same frozen year headers", () => {
    const income = buildPageThreeIncomeStatementTable(sampleFrozenYears, undefined);
    const balance = buildPageThreeBalanceSheetTable(sampleFrozenYears, undefined);
    const coverage = buildPageThreeCoverageTable(sampleFrozenYears, undefined);
    expect(balance.yearHeaders).toEqual(income.yearHeaders);
    expect(coverage.yearHeaders).toEqual(income.yearHeaders);
  });
});
