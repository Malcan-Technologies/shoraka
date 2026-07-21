/**
 * Credit Insights catalogues and approval validation — five mandatory rows.
 */

import {
  emptyProspectusReviewContent,
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
  it("exposes provisional per-row catalogues without Do not display", () => {
    expect(PROSPECTUS_OPTION_CATALOGUE_VERSION).toContain("investor-takeaways");
    const catalogues = getActiveProspectusCatalogues();
    expect(Array.isArray(catalogues.creditInsights)).toBe(false);
    expect(catalogues.creditInsights.creditScore.map((o) => o.key)).toEqual([
      "excellent",
      "good",
      "fair",
      "weak",
      "poor",
    ]);
    expect(catalogues.creditInsights.creditUtilisation.map((o) => o.key)).toEqual([
      "low",
      "healthy",
      "moderate",
      "high",
      "very_high",
    ]);
    expect(catalogues.creditInsights.litigationCheck.map((o) => o.key)).toEqual([
      "clear",
      "record_found",
      "under_review",
    ]);
    expect(catalogues.creditInsights.ccrisStatus.map((o) => o.key)).toEqual([
      "no_record",
      "satisfactory",
      "attention_required",
      "adverse_record",
      "under_review",
    ]);
    for (const field of Object.keys(PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE)) {
      expect(
        catalogues.creditInsights[field as keyof typeof catalogues.creditInsights].some(
          (o) => o.key === "do_not_display" || o.label === "Do not display"
        )
      ).toBe(false);
    }
  });

  it("rejects cross-row option keys and retired do_not_display", () => {
    const draft = emptyProspectusReviewContent();
    draft.page2.creditInsights = {
      creditScoreOptionKey: "healthy",
      paymentBehaviourOptionKey: "good",
      creditUtilisationOptionKey: "good",
      litigationCheckOptionKey: "clear",
      ccrisStatusOptionKey: "do_not_display",
    };
    const errors = validateDraftContent(draft);
    expect(errors.some((e) => e.path.includes("creditScoreOptionKey"))).toBe(true);
    expect(errors.some((e) => e.path.includes("creditUtilisationOptionKey"))).toBe(true);
    expect(errors.some((e) => e.path.includes("ccrisStatusOptionKey"))).toBe(true);
  });

  it("rejects do_not_display for every Credit Insights row", () => {
    for (const field of [
      "creditScoreOptionKey",
      "paymentBehaviourOptionKey",
      "creditUtilisationOptionKey",
      "litigationCheckOptionKey",
      "ccrisStatusOptionKey",
    ] as const) {
      const draft = buildCompleteProspectusReviewDraft();
      draft.page2.creditInsights = {
        ...draft.page2.creditInsights,
        [field]: "do_not_display",
      };
      const errors = validateDraftContent(draft);
      expect(errors.some((e) => e.path.includes(field))).toBe(true);
    }
  });

  it("requires all five real selections for approval", () => {
    const missing = emptyProspectusReviewContent();
    expect(
      validateApprovalContent(missing).some((e) => e.path.includes("creditInsights"))
    ).toBe(true);

    const oneMissing = buildCompleteProspectusReviewDraft();
    oneMissing.page2.creditInsights.litigationCheckOptionKey = null;
    expect(
      validateApprovalContent(oneMissing).some((e) =>
        e.path.includes("litigationCheckOptionKey")
      )
    ).toBe(true);

    const complete = buildCompleteProspectusReviewDraft();
    expect(validateApprovalContent(complete)).toEqual([]);

    const publication = toProspectusPublicationContent(complete);
    expect(publication.creditInsightSelections).toEqual({
      creditScore: "good",
      paymentBehaviour: "good",
      creditUtilisation: "healthy",
      litigationCheck: "clear",
      ccrisStatus: "no_record",
    });
  });

  it("keeps demo storage OptionKey field names and Canva demo values", () => {
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
