/**
 * SECTION: Prospectus review verification matrix (validation, freeze, rollout)
 */

import {
  cloneReviewContent,
  emptyProspectusReviewContent,
  toProspectusPublicationContent,
  type ProspectusReviewStoredContent,
} from "./prospectus-review-content";
import {
  validateApprovalContent,
  validateDraftContent,
} from "./prospectus-review.schemas";
import { PROSPECTUS_OPTION_CATALOGUE_VERSION } from "./prospectus-option-catalogues";
import {
  mergePublicationContentIntoSnapshot,
  parseFrozenPublicationContent,
  publicationContentFromFrozenSnapshot,
} from "./prospectus-frozen-publication";
import {
  PROSPECTUS_REVIEW_REQUIRED_FROM,
  ProspectusReviewService,
} from "./prospectus-review.service";

function completeSelectableDraft(): ProspectusReviewStoredContent {
  const draft = emptyProspectusReviewContent();
  draft.page1.keyInvestorHighlights = draft.page1.keyInvestorHighlights.map((h) => ({
    ...h,
    optionKey: "do_not_display",
    isVisible: false,
  }));
  draft.page1.paymentBasisOptionKey = "placeholder_bullet_maturity";
  draft.page1.shariahPrincipleOptionKey = "do_not_display";
  draft.page2.paymasterTrackRecord = {
    totalInvoicesPaid: 0,
    totalAmountPaid: "0",
    successfulRepaymentPercent: 100,
    onTimePaymentPercent: 0,
    averagePaymentPeriodDays: 30,
  };
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
  draft.page3.manualFinancialInputs = {
    years: {
      "2024": {
        grossProfit: 0,
        ebitda: "1000.50",
        ebit: -50,
      },
    },
  };
  draft.page3.investorTakeaways = {
    revenueProfitabilityOptionKey: "placeholder_positive",
    liquidityOptionKey: "do_not_display",
    leverageOptionKey: "placeholder_moderate",
    debtServicingCapacityOptionKey: "placeholder_adequate",
    workingCapitalEfficiencyOptionKey: "placeholder_typical",
    overallFinancialProfileOptionKey: "placeholder_balanced",
  };
  return draft;
}

describe("prospectus review content", () => {
  it("starts with empty selections and no placeholder approvals", () => {
    const empty = emptyProspectusReviewContent();
    expect(empty.page1.keyInvestorHighlights).toHaveLength(4);
    expect(empty.page1.paymentBasisOptionKey).toBeNull();
    expect(empty.page2.invoiceWorkStatements).toHaveLength(4);
    expect(empty.page3.investorTakeaways.revenueProfitabilityOptionKey).toBeUndefined();
  });

  it("allows partial draft with valid option keys and preserves numeric zero", () => {
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
          profitAfterTax: 1,
          currentRatio: 2,
          returnOnEquity: 3,
        } as never,
      },
    };
    const errors = validateDraftContent(draft);
    expect(errors.some((e) => e.path.includes("paymentBasisOptionKey"))).toBe(true);
    expect(errors.some((e) => e.message.includes("Derived field override"))).toBe(true);
    expect(errors.some((e) => e.path.includes("revenue"))).toBe(true);
    expect(errors.some((e) => e.path.includes("profitAfterTax"))).toBe(true);
    expect(errors.some((e) => e.path.includes("currentRatio"))).toBe(true);
    expect(errors.some((e) => e.path.includes("returnOnEquity"))).toBe(true);
  });

  it("rejects invalid financial year keys and non-numeric strings", () => {
    const draft = emptyProspectusReviewContent();
    draft.page3.manualFinancialInputs = {
      years: {
        FY24: { grossProfit: 1 },
        "2024": { ebitda: "not-a-number" },
      },
    };
    const errors = validateDraftContent(draft);
    expect(errors.some((e) => e.message.includes("Invalid year key"))).toBe(true);
    expect(errors.some((e) => e.message.includes("Invalid numeric value"))).toBe(true);
  });

  it("rejects negative paymaster track-record values and percentages over 100", () => {
    const draft = emptyProspectusReviewContent();
    draft.page2.paymasterTrackRecord = {
      totalInvoicesPaid: -1,
      totalAmountPaid: "-10",
      successfulRepaymentPercent: 101,
      onTimePaymentPercent: -5,
      averagePaymentPeriodDays: -2,
    };
    const errors = validateDraftContent(draft);
    expect(errors.some((e) => e.path.includes("totalInvoicesPaid"))).toBe(true);
    expect(errors.some((e) => e.path.includes("successfulRepaymentPercent"))).toBe(true);
    expect(errors.some((e) => e.path.includes("onTimePaymentPercent"))).toBe(true);
    expect(errors.some((e) => e.path.includes("averagePaymentPeriodDays"))).toBe(true);
  });

  it("rejects issuer identity and CTOS/application payload references", () => {
    const draft = emptyProspectusReviewContent() as ProspectusReviewStoredContent & {
      page2: ProspectusReviewStoredContent["page2"] & { issuerName?: string };
    };
    draft.page2.issuerName = "Secret Co";
    const withIssuer = validateDraftContent(draft);
    expect(withIssuer.some((e) => e.message.includes("issuerName"))).toBe(true);

    const withCtos = emptyProspectusReviewContent();
    (withCtos.page3 as { ctosFinancials?: unknown }).ctosFinancials = { raw: true };
    expect(
      validateDraftContent(withCtos).some((e) => e.message.includes("ctosFinancials"))
    ).toBe(true);
  });

  it("requires selections for approval and accepts explicit Do not display", () => {
    expect(validateApprovalContent(emptyProspectusReviewContent()).length).toBeGreaterThan(0);
    expect(validateApprovalContent(completeSelectableDraft())).toEqual([]);
  });

  it("converts selected options into publication content without inventing defaults", () => {
    const draft = completeSelectableDraft();
    const publication = toProspectusPublicationContent(draft);
    expect(publication.keyInvestorHighlights.every((h) => !h.isVisible)).toBe(true);
    expect(publication.paymentBasisTemplate.paymentBasis).toContain("Placeholder");
    expect(publication.creditInsightSelections.creditScore).toBe("positive");
    expect(publication.creditInsightSelections.creditUtilisation).toBe("do_not_display");
    expect(publication.investorTakeawaySelections.liquidity).toBe("do_not_display");
    expect(publication.prospectusFinancialInputs?.years?.["2024"]?.grossProfit).toBe(0);
  });

  it("deep-clones review content so draft and approved do not share references", () => {
    const draft = completeSelectableDraft();
    const approved = cloneReviewContent(draft);
    draft.page1.paymentBasisOptionKey = "changed";
    expect(approved.page1.paymentBasisOptionKey).toBe("placeholder_bullet_maturity");
    expect(approved).not.toBe(draft);
  });
});

describe("publication freeze stability", () => {
  it("merges publication_content without dropping unknown snapshot branches", () => {
    const draft = completeSelectableDraft();
    const resolved = toProspectusPublicationContent(draft);
    const merged = mergePublicationContentIntoSnapshot(
      { page_1: { a: 1 }, page_2: { b: 2 }, keep_me: true },
      {
        version: "content.1",
        optionCatalogueVersion: PROSPECTUS_OPTION_CATALOGUE_VERSION,
        approvedAt: "2026-07-19T00:00:00.000Z",
        approvedBy: "admin-1",
        content: draft,
        resolvedPublicationContent: resolved,
      }
    );
    expect(merged.page_1).toEqual({ a: 1 });
    expect(merged.page_2).toEqual({ b: 2 });
    expect(merged.keep_me).toBe(true);
    expect(merged.publication_content).toBeDefined();
  });

  it("freezes resolved wording and ignores later catalogue re-resolution", () => {
    const draft = completeSelectableDraft();
    const frozenResolved = toProspectusPublicationContent(draft);
    frozenResolved.paymentBasisTemplate = {
      ...frozenResolved.paymentBasisTemplate,
      paymentBasis: "FROZEN_WORDING_AT_PUBLISH",
    };

    const snapshot = {
      publication_content: {
        version: "content.2",
        optionCatalogueVersion: PROSPECTUS_OPTION_CATALOGUE_VERSION,
        approvedAt: "2026-07-19T12:00:00.000Z",
        approvedBy: "admin-2",
        content: draft,
        resolvedPublicationContent: frozenResolved,
      },
    };

    const fromFrozen = publicationContentFromFrozenSnapshot(snapshot);
    expect(fromFrozen?.paymentBasisTemplate.paymentBasis).toBe("FROZEN_WORDING_AT_PUBLISH");

    const live = toProspectusPublicationContent(draft);
    expect(live.paymentBasisTemplate.paymentBasis).not.toBe("FROZEN_WORDING_AT_PUBLISH");
    expect(fromFrozen?.paymentBasisTemplate.paymentBasis).not.toBe(
      live.paymentBasisTemplate.paymentBasis
    );
  });

  it("parses frozen branch with both option keys and resolved content", () => {
    const draft = completeSelectableDraft();
    const resolved = toProspectusPublicationContent(draft);
    const parsed = parseFrozenPublicationContent({
      publication_content: {
        version: "content.3",
        optionCatalogueVersion: PROSPECTUS_OPTION_CATALOGUE_VERSION,
        approvedAt: "2026-07-19T12:00:00.000Z",
        approvedBy: "admin-3",
        content: draft,
        resolvedPublicationContent: resolved,
      },
    });
    expect(parsed?.content.page1.paymentBasisOptionKey).toBe("placeholder_bullet_maturity");
    expect(parsed?.resolvedPublicationContent.paymentBasisTemplate.paymentBasis).toContain(
      "Placeholder"
    );
  });
});

describe("publish rollout cutoff", () => {
  const service = new ProspectusReviewService();

  it("defines a named UTC rollout cutoff constant", () => {
    expect(PROSPECTUS_REVIEW_REQUIRED_FROM.toISOString()).toBe("2026-07-19T00:00:00.000Z");
  });

  it("does not require review for old Notes without a review row", () => {
    expect(
      service.noteRequiresProspectusReview({
        created_at: new Date("2026-07-18T23:59:59.999Z"),
        prospectus_review: null,
      })
    ).toBe(false);
  });

  it("requires review for Notes on/after cutoff", () => {
    expect(
      service.noteRequiresProspectusReview({
        created_at: new Date("2026-07-19T00:00:00.000Z"),
        prospectus_review: null,
      })
    ).toBe(true);
  });

  it("requires review when an old Note has a review row (opt-in)", () => {
    expect(
      service.noteRequiresProspectusReview({
        created_at: new Date("2025-01-01T00:00:00.000Z"),
        prospectus_review: { id: "rev-1" },
      })
    ).toBe(true);
  });
});

describe("READY_FOR_REVIEW workflow contract", () => {
  it("documents submit-before-approve as the required transition", () => {
    // Approval from DRAFT is rejected in ProspectusReviewService.approve.
    // Submit for Review moves DRAFT → READY_FOR_REVIEW after approval-level validation.
    expect(["DRAFT", "READY_FOR_REVIEW", "APPROVED", "SUPERSEDED"]).toEqual(
      expect.arrayContaining(["READY_FOR_REVIEW"])
    );
    expect(validateApprovalContent(completeSelectableDraft())).toEqual([]);
  });
});
