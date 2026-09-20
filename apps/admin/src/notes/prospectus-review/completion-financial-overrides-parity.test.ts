import type { ProspectusReviewStoredContent } from "@cashsouk/types";
import {
  buildProspectusMissingRequiredFields,
  isProspectusDraftReadyToSubmit,
} from "./completion";

const YEARS = ["2022", "2023"] as const;

function buildBaseCompleteDraft(years: readonly string[]): ProspectusReviewStoredContent {
  return {
    page1: {
      keyInvestorHighlights: [
        { key: "paymaster", title: "t", description: "d" },
        { key: "issuer_fundamentals", title: "t", description: "d" },
        { key: "return", title: "t", description: "d" },
        { key: "shariah", title: "", description: "" },
      ],
    },
    page2: {
      issuerProfile: { companySize: "Medium" },
      invoicePaymaster: { deedOfAssignment: "Yes" },
      creditInsights: {
        litigationCheckOptionKey: "clear",
        ccrisStatusOptionKey: "no_record",
      },
      aboutInvoice: {
        items: [
          { id: "work_under_contract", text: "x", sourceType: "OFFICER_ENTERED" },
          { id: "certification_acceptance", text: "x", sourceType: "OFFICER_ENTERED" },
          { id: "paymaster_trust_account", text: "x", sourceType: "OFFICER_ENTERED" },
          { id: "deed_of_assignment", text: "x", sourceType: "OFFICER_ENTERED" },
        ],
      },
      // Overrides set per test
      financialComparison: { overrides: {} },
    },
    page3: {
      investorTakeaways: {
        revenueProfitabilityOptionKey: "steady_growth",
        liquidityOptionKey: "do_not_display",
        leverageOptionKey: "conservative_improving",
        debtServicingCapacityOptionKey: "adequate_improving",
        receivablesCollectionOptionKey: "improving",
        overallFinancialProfileOptionKey: "strengthening",
      },
      manualFinancialInputs: {
        years: Object.fromEntries(
          years.map((year) => [
            year,
            {
              grossProfit: 1,
              ebitda: 1,
              ebit: 1,
              cashAndBank: 1,
              tradeReceivables: 1,
              totalEquity: 1,
              quickRatio: 1,
              payablesDays: 10,
            },
          ])
        ),
      },
    },
  };
}

function setOverrides(
  draft: ProspectusReviewStoredContent,
  year: string,
  overrides: Partial<
    ProspectusReviewStoredContent["page2"]["financialComparison"] extends infer T
      ? T extends { overrides?: infer U }
        ? U extends Record<string, infer V>
          ? V
          : never
        : never
      : never
  >
) {
  const bag = draft.page2.financialComparison?.overrides ?? {};
  const key = `${year}-12-31`;
  draft.page2.financialComparison = {
    overrides: {
      ...bag,
      [key]: {
        ...(bag[key] ?? {}),
        ...overrides,
      },
    },
  };
}

describe("prospectus completion — Page 2 financial override numeric parity", () => {
  it("treats empty/null/undefined override values as missing across all displayed years", () => {
    const draft = buildBaseCompleteDraft(YEARS);
    for (const year of YEARS) {
      setOverrides(draft, year, {
        netDebtEquity: "",
        interestCoverage: null,
        dscr: undefined,
        receivablesDays: undefined,
      });
    }

    const missing = buildProspectusMissingRequiredFields(draft, { incomeStatementYears: YEARS });
    const financialMissing = missing.filter((m) => m.section === "Financial Comparison");
    expect(financialMissing).toHaveLength(YEARS.length * 4);
    expect(isProspectusDraftReadyToSubmit(draft, { incomeStatementYears: YEARS })).toBe(false);
  });

  it("treats non-numeric override values as missing for required numeric fields", () => {
    const draft = buildBaseCompleteDraft(YEARS);
    for (const year of YEARS) {
      setOverrides(draft, year, {
        netDebtEquity: "abc",
        interestCoverage: "1..2",
        dscr: "not-a-number",
        receivablesDays: "45",
      });
    }

    const missing = buildProspectusMissingRequiredFields(draft, { incomeStatementYears: YEARS });
    const financialMissing = missing.filter((m) => m.section === "Financial Comparison");
    // netDebtEquity + interestCoverage + dscr per year (receivablesDays is valid)
    expect(financialMissing).toHaveLength(YEARS.length * 3);
    expect(financialMissing.some((m) => m.field === "Receivables Days")).toBe(false);
    expect(isProspectusDraftReadyToSubmit(draft, { incomeStatementYears: YEARS })).toBe(false);
  });

  it("treats valid decimal override values as complete for netDebtEquity/interestCoverage/dscr", () => {
    const draft = buildBaseCompleteDraft(YEARS);
    for (const year of YEARS) {
      setOverrides(draft, year, {
        netDebtEquity: "0.4",
        interestCoverage: "3.5",
        dscr: "1.2",
        receivablesDays: "45",
      });
    }

    const missing = buildProspectusMissingRequiredFields(draft, { incomeStatementYears: YEARS });
    const financialMissing = missing.filter((m) => m.section === "Financial Comparison");
    expect(financialMissing).toHaveLength(0);
    expect(isProspectusDraftReadyToSubmit(draft, { incomeStatementYears: YEARS })).toBe(true);
  });

  it("treats receivablesDays decimal (e.g. 1.5) as incomplete", () => {
    const draft = buildBaseCompleteDraft(YEARS);
    for (const year of YEARS) {
      setOverrides(draft, year, {
        netDebtEquity: "0.4",
        interestCoverage: "3.5",
        dscr: "1.2",
        receivablesDays: "1.5",
      });
    }

    const missing = buildProspectusMissingRequiredFields(draft, { incomeStatementYears: YEARS });
    const receivablesMissing = missing.filter(
      (m) => m.section === "Financial Comparison" && m.field === "Receivables Days"
    );
    expect(receivablesMissing).toHaveLength(YEARS.length);
    expect(isProspectusDraftReadyToSubmit(draft, { incomeStatementYears: YEARS })).toBe(false);
  });

  it("keeps overall Ready/Complete false when any displayed year has invalid receivablesDays", () => {
    const draft = buildBaseCompleteDraft(YEARS);

    setOverrides(draft, YEARS[0], {
      netDebtEquity: "0.4",
      interestCoverage: "3.5",
      dscr: "1.2",
      receivablesDays: "45",
    });

    setOverrides(draft, YEARS[1], {
      netDebtEquity: "0.4",
      interestCoverage: "3.5",
      dscr: "1.2",
      receivablesDays: "1.5",
    });

    expect(isProspectusDraftReadyToSubmit(draft, { incomeStatementYears: YEARS })).toBe(false);
  });

  it("treats negative required override values as incomplete (backend would reject)", () => {
    const draft = buildBaseCompleteDraft(YEARS);
    setOverrides(draft, YEARS[0], {
      netDebtEquity: "-0.1",
      interestCoverage: "3.5",
      dscr: "1.2",
      receivablesDays: "45",
    });
    setOverrides(draft, YEARS[1], {
      netDebtEquity: "0.4",
      interestCoverage: "3.5",
      dscr: "1.2",
      receivablesDays: "45",
    });

    const missing = buildProspectusMissingRequiredFields(draft, { incomeStatementYears: YEARS });
    const financialMissing = missing.filter((m) => m.section === "Financial Comparison");
    expect(financialMissing).toHaveLength(1);
    expect(financialMissing[0]?.field).toBe("Net Debt / Equity (x)");
    expect(isProspectusDraftReadyToSubmit(draft, { incomeStatementYears: YEARS })).toBe(false);
  });
});

