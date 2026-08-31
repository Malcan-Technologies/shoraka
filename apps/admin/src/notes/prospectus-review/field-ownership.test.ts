import type { ProspectusReviewStoredContent } from "@cashsouk/types";
import { buildProspectusMissingRequiredFields } from "./completion";

/**
 * Field ownership: one authoritative draft path per editable metric.
 * Reused displays must read the same draft path (no duplicate stores).
 */
describe("prospectus working-area field ownership", () => {
  it("does not store paymasterRating or confidenceGrading on prospectus review content", () => {
    const draft: ProspectusReviewStoredContent = {
      page1: { keyInvestorHighlights: [] },
      page2: {
        creditInsights: {},
        invoicePaymaster: {
          deedOfAssignment: "Yes",
        },
        aboutInvoice: { items: [] },
      },
      page3: { investorTakeaways: {} },
    };
    expect(draft.page2.invoicePaymaster).toEqual({ deedOfAssignment: "Yes" });
    expect(draft.page2.invoicePaymaster).not.toHaveProperty("paymasterRating");
    expect(draft.page2.invoicePaymaster).not.toHaveProperty("confidenceGrading");
    expect(draft.page3).not.toHaveProperty("paymasterRating");
    expect(draft.page3).not.toHaveProperty("confidenceGrading");
  });

  it("stores IC / DSCR / Receivables Days only under page2 financial overrides", () => {
    const draft: ProspectusReviewStoredContent = {
      page1: { keyInvestorHighlights: [] },
      page2: {
        creditInsights: {},
        aboutInvoice: { items: [] },
        financialComparison: {
          overrides: {
            "2024-12-31": {
              interestCoverage: "3.5",
              dscr: "1.2",
              receivablesDays: "45",
              netDebtEquity: "0.4",
            },
          },
        },
      },
      page3: {
        investorTakeaways: {},
        manualFinancialInputs: {
          years: {
            "2024": {
              operatingCashFlow: "100",
            },
          },
        },
      },
    };
    const override = draft.page2.financialComparison?.overrides?.["2024-12-31"];
    expect(override?.interestCoverage).toBe("3.5");
    expect(override?.dscr).toBe("1.2");
    expect(override?.receivablesDays).toBe("45");
    const manual = draft.page3.manualFinancialInputs?.years?.["2024"] ?? {};
    expect("interestCoverage" in manual).toBe(false);
    expect("dscr" in manual).toBe(false);
    expect("receivablesDays" in manual).toBe(false);
  });

  it("does not list optional paymaster track fields as missing required", () => {
    const draft: ProspectusReviewStoredContent = {
      page1: {
        keyInvestorHighlights: [
          { key: "paymaster", title: "a", description: "b" },
          { key: "issuer_fundamentals", title: "a", description: "b" },
          { key: "return", title: "a", description: "b" },
          { key: "shariah", title: "a", description: "b" },
        ],
      },
      page2: {
        issuerProfile: { companySize: "Medium" },
        invoicePaymaster: {
          deedOfAssignment: "Yes",
        },
        creditInsights: {
          creditScoreOptionKey: "good",
          paymentBehaviourOptionKey: "good",
          creditUtilisationOptionKey: "healthy",
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
        paymasterTrackRecord: {},
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
      },
    };
    const missing = buildProspectusMissingRequiredFields(draft);
    expect(missing.some((m) => m.field.includes("Invoices Paid"))).toBe(false);
    expect(missing.some((m) => m.section === "Paymaster Track Record")).toBe(false);
  });

  it("does not store MARC grade, score, or PD on the prospectus draft", () => {
    const draft: ProspectusReviewStoredContent = {
      page1: { keyInvestorHighlights: [] },
      page2: {
        creditInsights: {
          litigationCheckOptionKey: "clear",
          ccrisStatusOptionKey: "no_record",
        },
        invoicePaymaster: {
          deedOfAssignment: "Yes",
        },
        aboutInvoice: { items: [] },
      },
      page3: { investorTakeaways: {} },
    };
    expect(draft.page2.creditInsights).not.toHaveProperty("marcCreditGrade");
    expect(draft.page2.creditInsights).not.toHaveProperty("marcConfidenceGrading");
    expect(draft.page2.invoicePaymaster).not.toHaveProperty("marcPaymasterGrading");
  });
});
