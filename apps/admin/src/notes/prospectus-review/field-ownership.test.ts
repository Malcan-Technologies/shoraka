import type { ProspectusReviewStoredContent } from "@cashsouk/types";
import { buildProspectusMissingRequiredFields } from "./completion";

/**
 * Field ownership: one authoritative draft path per editable metric.
 * Reused displays must read the same draft path (no duplicate stores).
 */
describe("prospectus working-area field ownership", () => {
  it("stores Paymaster Rating and Confidence only under page2.invoicePaymaster", () => {
    const draft: ProspectusReviewStoredContent = {
      page1: { keyInvestorHighlights: [] },
      page2: {
        creditInsights: {},
        invoicePaymaster: {
          paymasterRating: "PM2",
          confidenceGrading: "Medium",
        },
        aboutInvoice: { items: [] },
      },
      page3: { investorTakeaways: {} },
    };
    expect(draft.page2.invoicePaymaster?.paymasterRating).toBe("PM2");
    expect(draft.page2.invoicePaymaster?.confidenceGrading).toBe("Medium");
    expect(
      (draft.page3 as { paymasterRating?: string }).paymasterRating
    ).toBeUndefined();
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
          paymasterRating: "PM1",
          confidenceGrading: "High",
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
});
