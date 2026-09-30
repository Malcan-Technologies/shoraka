jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import {
  FINANCIAL_REVIEW_CALCULATED_KEYS,
  type FinancialReviewCalculatedValues,
  type NoteDetail,
  type ProspectusFrozenFinancialRaw,
  type ProspectusFrozenFinancialYear,
} from "@cashsouk/types";
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
      details: { value: 625_000, maturity_date: "2026-11-22T00:00:00.000Z" },
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

function frozenYear(
  calendarYear: number,
  raw: Partial<ProspectusFrozenFinancialRaw>,
  calculated: Partial<FinancialReviewCalculatedValues>,
  isPlaceholder = false
): ProspectusFrozenFinancialYear {
  const storedCalculated = {} as FinancialReviewCalculatedValues;
  for (const key of FINANCIAL_REVIEW_CALCULATED_KEYS) storedCalculated[key] = calculated[key] ?? null;
  return {
    financialYearEndIso: `${calendarYear}-12-31`,
    calendarYear,
    label: `FY${calendarYear}`,
    fyeLabel: `31 Dec ${calendarYear}`,
    sourceType: "ISSUER_INPUT",
    statementType: "MANAGEMENT_ACCOUNTS",
    raw: raw as ProspectusFrozenFinancialRaw,
    calculated: storedCalculated,
    isPlaceholder,
  };
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
    expect(rows.find((r) => r.label === "Paymaster Rating")).toBeUndefined();
    expect(rows.find((r) => r.label === "Confidence Grading")).toBeUndefined();
    expect(rows.find((r) => r.label === "Invoice Due Date")?.value).toBe("22 November 2026");
    expect(rows.find((r) => r.label === "Invoice Due Date")?.value).not.toBe(
      "31 December 2026"
    );
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
    const table = buildPageTwoFinancialComparisonTable([
      frozenYear(2023, { turnover: 1000, plnpat: 100 }, { profit_margin: 10, return_on_equity: 20, currat: 2 }),
      frozenYear(2024, { turnover: 2000, plnpat: 200 }, { profit_margin: 10, return_on_equity: 25, currat: 2 }),
    ]);
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
    const netDebtRow = table.rows.find((r) => r.metric === "Net Debt / Equity (x)");
    expect(netDebtRow?.cellHints?.every((h) => h == null)).toBe(true);
    expect(table.rows.every((r) => r.trend == null)).toBe(true);

    // Guard: Prospectus presentation-only must not include diagnostic missing reasons.
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
    const serialized = JSON.stringify(table);
    for (const s of forbidden) expect(serialized).not.toContain(s);
  });

  it("calculated rows read the stored values (percent points, never × 100); raw metric fields are ignored", () => {
    const table = buildPageTwoFinancialComparisonTable([
      frozenYear(
        2024,
        {
          turnover: 2000,
          plnpat: 200,
          return_on_equity: 99,
          currat: 9,
          netDebtEquity: 9,
          interestCoverage: 9,
          dscr: 9,
          receivablesDays: 999,
        },
        {
          profit_margin: 12.5,
          return_on_equity: 8.6,
          currat: 1.32,
          netDebtEquity: 0.4,
          interestCoverage: 7.5,
          dscr: 2,
          receivablesDays: 45.9,
        }
      ),
    ]);
    const value = (metric: string) => table.rows.find((r) => r.metric === metric)?.values[0];
    expect(value("Net Profit Margin (%)")).toBe("12.5%");
    expect(value("ROE (%)")).toBe("8.6%");
    expect(value("Current Ratio (x)")).toBe("1.32x");
    expect(value("Net Debt / Equity (x)")).toBe("0.4x");
    expect(value("Interest Coverage (x)")).toBe("7.5x");
    expect(value("DSCR (x)")).toBe("2x");
    expect(value("Receivables Days")).toBe("45");
    expect(table.yearHeaders[0]).toEqual({ key: "2024", yearLabel: "FY2024", fyeLabel: "31 Dec 2024" });
  });

  it("placeholder years show — on every row", () => {
    const table = buildPageTwoFinancialComparisonTable([
      frozenYear(2023, { turnover: 1000 }, { profit_margin: 10 }, true),
      frozenYear(2024, { turnover: 2000 }, { profit_margin: 10 }),
    ]);
    for (const row of table.rows) expect(row.values[0]).toBe("—");
    expect(table.rows.find((r) => r.metric === "Net Profit Margin (%)")?.values[1]).toBe("10%");
  });
});
