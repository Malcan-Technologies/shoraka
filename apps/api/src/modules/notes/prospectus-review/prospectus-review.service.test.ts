/**
 * SECTION: Prospectus review service unit tests (validation + content conversion)
 */

import {
  emptyProspectusReviewContent,
  toProspectusPublicationContent,
} from "./prospectus-review-content";
import {
  validateApprovalContent,
  validateDraftContent,
} from "./prospectus-review.schemas";
import { PROSPECTUS_OPTION_CATALOGUE_VERSION } from "./prospectus-option-catalogues";
import { mergePublicationContentIntoSnapshot } from "./prospectus-frozen-publication";
import { PROSPECTUS_REVIEW_REQUIRED_FROM } from "./prospectus-review.service";

describe("prospectus review content", () => {
  it("starts with empty selections and no placeholder approvals", () => {
    const empty = emptyProspectusReviewContent();
    expect(empty.page1.keyInvestorHighlights).toHaveLength(4);
    expect(empty.page1.paymentBasisOptionKey).toBeNull();
    expect(empty.page2.invoiceWorkStatements).toHaveLength(4);
    expect(empty.page3.investorTakeaways.revenueProfitabilityOptionKey).toBeUndefined();
  });

  it("allows partial draft with valid option keys", () => {
    const draft = emptyProspectusReviewContent();
    draft.page1.paymentBasisOptionKey = "placeholder_bullet_maturity";
    draft.page3.manualFinancialInputs = {
      years: { "2024": { grossProfit: 0, ebitda: "1000" } },
    };
    expect(validateDraftContent(draft)).toEqual([]);
  });

  it("rejects invalid option keys and derived overrides", () => {
    const draft = emptyProspectusReviewContent();
    draft.page1.paymentBasisOptionKey = "not_a_real_option";
    draft.page3.manualFinancialInputs = {
      years: {
        "2024": {
          grossProfit: 1,
          revenue: 999,
        } as never,
      },
    };
    const errors = validateDraftContent(draft);
    expect(errors.some((e) => e.path.includes("paymentBasisOptionKey"))).toBe(true);
    expect(errors.some((e) => e.message.includes("Derived field override"))).toBe(true);
  });

  it("requires selections for approval", () => {
    const draft = emptyProspectusReviewContent();
    const errors = validateApprovalContent(draft);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.path.includes("paymentBasisOptionKey"))).toBe(true);
  });

  it("converts selected options into publication content without inventing defaults", () => {
    const draft = emptyProspectusReviewContent();
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
      isVisible: false,
    }));
    draft.page3.investorTakeaways = {
      revenueProfitabilityOptionKey: "placeholder_positive",
      liquidityOptionKey: "do_not_display",
      leverageOptionKey: "placeholder_moderate",
      debtServicingCapacityOptionKey: "placeholder_adequate",
      workingCapitalEfficiencyOptionKey: "placeholder_typical",
      overallFinancialProfileOptionKey: "placeholder_balanced",
    };

    expect(validateApprovalContent(draft)).toEqual([]);
    const publication = toProspectusPublicationContent(draft);
    expect(publication.keyInvestorHighlights.every((h) => !h.isVisible)).toBe(true);
    expect(publication.paymentBasisTemplate.paymentBasis).toContain("Placeholder");
    expect(publication.creditInsightSelections.creditScore).toBe("positive");
    expect(publication.creditInsightSelections.creditUtilisation).toBe("do_not_display");
    expect(publication.investorTakeawaySelections.liquidity).toBe("do_not_display");
  });

  it("merges publication_content without dropping page_1/page_2", () => {
    const merged = mergePublicationContentIntoSnapshot(
      { page_1: { a: 1 }, page_2: { b: 2 }, keep_me: true },
      {
        version: "content.1",
        optionCatalogueVersion: PROSPECTUS_OPTION_CATALOGUE_VERSION,
        approvedAt: "2026-07-19T00:00:00.000Z",
        approvedBy: "admin-1",
        content: emptyProspectusReviewContent(),
      }
    );
    expect(merged.page_1).toEqual({ a: 1 });
    expect(merged.page_2).toEqual({ b: 2 });
    expect(merged.keep_me).toBe(true);
    expect(merged.publication_content).toBeDefined();
  });

  it("defines a rollout cutoff for publish requirement", () => {
    expect(PROSPECTUS_REVIEW_REQUIRED_FROM.toISOString()).toBe("2026-07-19T00:00:00.000Z");
  });
});
