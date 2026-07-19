import {
  formatActorDisplayName,
  formatProspectusReviewStatus,
  looksLikeRawKey,
  PROSPECTUS_STEP_GROUPS,
  PROSPECTUS_STEP_TITLES,
  HIGHLIGHT_FIELD_LABELS,
  INVOICE_WORK_FIELD_LABELS,
} from "./labels";
import {
  buildProspectusCompletionChecklist,
  isProspectusDraftReadyToSubmit,
} from "./completion";
import type { ProspectusReviewStoredContent } from "@cashsouk/types";

describe("prospectus review admin labels", () => {
  it("formats review statuses for operations", () => {
    expect(formatProspectusReviewStatus("DRAFT")).toBe("Draft");
    expect(formatProspectusReviewStatus("READY_FOR_REVIEW")).toBe("Ready for Review");
    expect(formatProspectusReviewStatus("APPROVED")).toBe("Approved");
    expect(formatProspectusReviewStatus("SUPERSEDED")).toBe("Superseded");
  });

  it("uses concise step titles without repeated page prefixes", () => {
    expect(PROSPECTUS_STEP_TITLES[0]).toBe("Core Terms");
    expect(PROSPECTUS_STEP_TITLES[3]).toBe("Credit & Invoice Details");
    expect(PROSPECTUS_STEP_TITLES[6]).toBe("Preview & Approval");
    const mainLabels = PROSPECTUS_STEP_GROUPS.flatMap((g) => g.steps.map((s) => s.label));
    expect(mainLabels.every((label) => !label.startsWith("Page "))).toBe(true);
  });

  it("maps highlight and invoice work keys to business labels", () => {
    expect(HIGHLIGHT_FIELD_LABELS.paymaster).toBe("Paymaster Highlight");
    expect(HIGHLIGHT_FIELD_LABELS.issuer_fundamentals).toBe("Issuer Financial Strength");
    expect(INVOICE_WORK_FIELD_LABELS.work_under_contract).toBe(
      "Work Performed Under Contract"
    );
    expect(Object.values(HIGHLIGHT_FIELD_LABELS).some((v) => looksLikeRawKey(v))).toBe(false);
    expect(Object.values(INVOICE_WORK_FIELD_LABELS).some((v) => looksLikeRawKey(v))).toBe(false);
  });

  it("resolves actor display names without raw ids", () => {
    expect(
      formatActorDisplayName({ first_name: "Amina", last_name: "Tan", email: "a@example.com" })
    ).toBe("Amina Tan");
    expect(formatActorDisplayName({ first_name: null, last_name: null, email: "ops@example.com" })).toBe(
      "ops@example.com"
    );
    expect(formatActorDisplayName(null)).toBe("System");
    expect(formatActorDisplayName({ first_name: "", last_name: "", email: "" })).toBe("System");
  });
});

describe("prospectus review completion checklist", () => {
  function emptyDraft(): ProspectusReviewStoredContent {
    return {
      page1: {
        keyInvestorHighlights: [
          { key: "paymaster", optionKey: null, isVisible: true },
          { key: "issuer_fundamentals", optionKey: null, isVisible: true },
          { key: "return", optionKey: null, isVisible: true },
          { key: "shariah", optionKey: null, isVisible: true },
        ],
        paymentBasisOptionKey: null,
        shariahPrincipleOptionKey: null,
      },
      page2: {
        creditInsights: {},
        invoiceWorkStatements: [
          { key: "work_under_contract", optionKey: null, isVisible: true },
          { key: "certification_acceptance", optionKey: null, isVisible: true },
          { key: "paymaster_trust_account", optionKey: null, isVisible: true },
          { key: "deed_of_assignment", optionKey: null, isVisible: true },
        ],
      },
      page3: {
        investorTakeaways: {},
      },
    };
  }

  it("does not treat incomplete optional sections as submit blockers", () => {
    const draft = emptyDraft();
    draft.page1.keyInvestorHighlights = draft.page1.keyInvestorHighlights.map((h) => ({
      ...h,
      optionKey: "do_not_display",
      isVisible: false,
    }));
    draft.page1.paymentBasisOptionKey = "placeholder_bullet_maturity";
    draft.page1.shariahPrincipleOptionKey = "do_not_display";
    draft.page2.creditInsights = {
      creditScoreOptionKey: "positive",
      paymentBehaviourOptionKey: "neutral",
      creditUtilisationOptionKey: "do_not_display",
      litigationCheckOptionKey: "do_not_display",
      ccrisStatusOptionKey: "neutral",
    };
    draft.page2.invoiceWorkStatements = draft.page2.invoiceWorkStatements.map((s) => ({
      ...s,
      optionKey: "do_not_display",
    }));
    draft.page3.investorTakeaways = {
      revenueProfitabilityOptionKey: "placeholder_positive",
      liquidityOptionKey: "do_not_display",
      leverageOptionKey: "placeholder_moderate",
      debtServicingCapacityOptionKey: "placeholder_adequate",
      workingCapitalEfficiencyOptionKey: "placeholder_typical",
      overallFinancialProfileOptionKey: "placeholder_balanced",
    };

    const checklist = buildProspectusCompletionChecklist(draft);
    expect(checklist.find((i) => i.id === "paymaster")?.required).toBe(false);
    expect(checklist.find((i) => i.id === "financials")?.required).toBe(false);
    expect(isProspectusDraftReadyToSubmit(draft)).toBe(true);
  });
});
