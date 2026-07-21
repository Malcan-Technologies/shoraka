/**
 * Credit Insights catalogues, legacy Draft normalization, and approval validation.
 */

import {
  emptyProspectusReviewContent,
  normalizeCreditInsightSelections,
  toProspectusPublicationContent,
} from "./prospectus-review-content";
import { validateApprovalContent, validateDraftContent } from "./prospectus-review.schemas";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import {
  PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE,
  PROSPECTUS_OPTION_CATALOGUE_VERSION,
  getActiveProspectusCatalogues,
} from "./prospectus-option-catalogues";

describe("prospectus credit insights option catalogues", () => {
  it("exposes provisional per-row catalogues on the API catalogues payload", () => {
    expect(PROSPECTUS_OPTION_CATALOGUE_VERSION).toContain("credit-insights.provisional");
    const catalogues = getActiveProspectusCatalogues();
    expect(Array.isArray(catalogues.creditInsights)).toBe(false);
    expect(catalogues.creditInsights.creditScore.some((o) => o.key === "good")).toBe(true);
    expect(catalogues.creditInsights.creditUtilisation.some((o) => o.key === "healthy")).toBe(
      true
    );
    expect(catalogues.creditInsights.litigationCheck.some((o) => o.key === "clear")).toBe(true);
    expect(catalogues.creditInsights.ccrisStatus.some((o) => o.key === "no_record")).toBe(true);
    for (const field of Object.keys(PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE)) {
      expect(
        catalogues.creditInsights[field as keyof typeof catalogues.creditInsights].some(
          (o) => o.key === "do_not_display"
        )
      ).toBe(true);
    }
  });

  it("rejects cross-row option keys", () => {
    const draft = emptyProspectusReviewContent();
    draft.page2.creditInsights = {
      creditScoreOptionKey: "healthy",
      paymentBehaviourOptionKey: "good",
      creditUtilisationOptionKey: "good",
      litigationCheckOptionKey: "clear",
      ccrisStatusOptionKey: "no_record",
    };
    const errors = validateDraftContent(draft);
    expect(errors.some((e) => e.path.includes("creditScoreOptionKey"))).toBe(true);
    expect(errors.some((e) => e.path.includes("creditUtilisationOptionKey"))).toBe(true);
  });

  it("accepts legacy positive/neutral/negative after Draft normalization mapping", () => {
    const draft = emptyProspectusReviewContent();
    draft.page2.creditInsights = {
      creditScoreOptionKey: "positive",
      paymentBehaviourOptionKey: "neutral",
      creditUtilisationOptionKey: "negative",
      litigationCheckOptionKey: "positive",
      ccrisStatusOptionKey: "do_not_display",
    };
    expect(validateDraftContent(draft)).toEqual([]);
    const normalized = normalizeCreditInsightSelections(draft);
    expect(normalized.page2.creditInsights).toEqual({
      creditScoreOptionKey: "good",
      paymentBehaviourOptionKey: "satisfactory",
      creditUtilisationOptionKey: "high",
      litigationCheckOptionKey: "clear",
      ccrisStatusOptionKey: "do_not_display",
    });
  });

  it("requires all five selections for approval; do_not_display is valid", () => {
    const missing = emptyProspectusReviewContent();
    expect(
      validateApprovalContent(missing).some((e) => e.path.includes("creditInsights"))
    ).toBe(true);

    const complete = buildCompleteProspectusReviewDraft();
    expect(validateApprovalContent(complete)).toEqual([]);

    const allHidden = buildCompleteProspectusReviewDraft();
    allHidden.page2.creditInsights = {
      creditScoreOptionKey: "do_not_display",
      paymentBehaviourOptionKey: "do_not_display",
      creditUtilisationOptionKey: "do_not_display",
      litigationCheckOptionKey: "do_not_display",
      ccrisStatusOptionKey: "do_not_display",
    };
    expect(validateApprovalContent(allHidden)).toEqual([]);

    const publication = toProspectusPublicationContent(allHidden);
    expect(publication.creditInsightSelections).toEqual({
      creditScore: "do_not_display",
      paymentBehaviour: "do_not_display",
      creditUtilisation: "do_not_display",
      litigationCheck: "do_not_display",
      ccrisStatus: "do_not_display",
    });
  });

  it("keeps storage OptionKey field names on demo draft", () => {
    const draft = buildCompleteProspectusReviewDraft();
    expect(draft.page2.creditInsights).toEqual({
      creditScoreOptionKey: "good",
      paymentBehaviourOptionKey: "good",
      creditUtilisationOptionKey: "healthy",
      litigationCheckOptionKey: "clear",
      ccrisStatusOptionKey: "no_record",
    });
  });
});
