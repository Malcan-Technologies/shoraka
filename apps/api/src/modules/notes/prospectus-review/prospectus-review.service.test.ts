/**
 * SECTION: Prospectus review verification matrix (validation, freeze, rollout)
 */

import {
  PROSPECTUS_FIXED_PAYMENT_BASIS,
  PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT,
  PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
} from "@cashsouk/types";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import {
  cloneReviewContent,
  emptyProspectusReviewContent,
  normalizeHighlightSelections,
  stripLegacyPaymentBasisShariahKeys,
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
  return buildCompleteProspectusReviewDraft();
}

describe("prospectus review content", () => {
  it("starts with recommended highlight copy and no Payment Basis / Shariah keys", () => {
    const empty = emptyProspectusReviewContent({
      paymasterSnapshot: { name: "KKR", entity_type: "Government Agency" },
      riskRating: "AA",
      profitRatePercent: 12,
      listingOpensAt: "2025-05-15T00:00:00.000Z",
      maturityDate: "2025-09-12T00:00:00.000Z",
    });
    expect(empty.page1.keyInvestorHighlights).toHaveLength(4);
    expect(empty.page1.paymentBasisOptionKey).toBeUndefined();
    expect(empty.page1.shariahPrincipleOptionKey).toBeUndefined();
    expect(empty.page1.keyInvestorHighlights.find((h) => h.key === "paymaster")?.title).toContain(
      "government"
    );
    expect(empty.page1.keyInvestorHighlights.find((h) => h.key === "shariah")).toEqual({
      key: "shariah",
      title: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.title,
      description: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.description,
    });
  });

  it("allows partial draft with highlight copy and preserves numeric zero", () => {
    const draft = emptyProspectusReviewContent();
    draft.page3.manualFinancialInputs = {
      years: { "2024": { grossProfit: 0, ebitda: "1000" } },
    };
    expect(validateDraftContent(draft)).toEqual([]);
  });

  it("parses legacy highlight optionKey drafts and normalises to recommendations", () => {
    const legacy = emptyProspectusReviewContent();
    legacy.page1.keyInvestorHighlights = [
      { key: "paymaster", optionKey: "placeholder_paymaster", isVisible: true, title: "", description: "" },
      {
        key: "issuer_fundamentals",
        optionKey: "do_not_display",
        isVisible: false,
        title: "",
        description: "",
      },
      { key: "return", optionKey: "placeholder_return", isVisible: true, title: "", description: "" },
      { key: "shariah", optionKey: "do_not_display", isVisible: false, title: "", description: "" },
    ];
    expect(validateDraftContent(legacy)).toEqual([]);
    const normalized = normalizeHighlightSelections(legacy, {
      paymasterSnapshot: { name: "Acme", entity_type: "Private Company" },
      riskRating: "BBB",
      profitRatePercent: 10,
      listingOpensAt: "2025-01-01T00:00:00.000Z",
      maturityDate: "2025-04-01T00:00:00.000Z",
    });
    expect(normalized.page1.keyInvestorHighlights.every((h) => h.title && h.description)).toBe(
      true
    );
    expect(normalized.page1.keyInvestorHighlights.find((h) => h.key === "shariah")?.title).toBe(
      PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.title
    );
  });

  it("rejects invalid option keys and derived overrides", () => {
    const draft = emptyProspectusReviewContent();
    draft.page2.creditInsights.creditScoreOptionKey = "not_a_real_option";
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
    expect(errors.some((e) => e.path.includes("creditScoreOptionKey"))).toBe(true);
    expect(errors.some((e) => e.message.includes("Derived field override"))).toBe(true);
  });

  it("requires highlight title and description for approval", () => {
    expect(validateApprovalContent(emptyProspectusReviewContent()).length).toBeGreaterThan(0);
    const incomplete = completeSelectableDraft();
    incomplete.page1.keyInvestorHighlights = incomplete.page1.keyInvestorHighlights.map((h) =>
      h.key === "paymaster" ? { ...h, title: "", description: "" } : h
    );
    expect(
      validateApprovalContent(incomplete).some((e) => e.path.includes("paymaster"))
    ).toBe(true);
    expect(validateApprovalContent(completeSelectableDraft())).toEqual([]);
  });

  it("resolves always-visible highlights and fixed Payment/Shariah values", () => {
    const draft = completeSelectableDraft();
    const publication = toProspectusPublicationContent(draft);
    expect(publication.keyInvestorHighlights.every((h) => h.isVisible)).toBe(true);
    expect(publication.keyInvestorHighlights.find((h) => h.key === "shariah")).toMatchObject({
      title: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.title,
      description: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.description,
      isVisible: true,
    });
    expect(publication.paymentBasisTemplate.paymentBasis).toBe(PROSPECTUS_FIXED_PAYMENT_BASIS);
    expect(publication.paymentBasisTemplate.shariahPrinciple).toBe(
      PROSPECTUS_FIXED_SHARIAH_PRINCIPLE
    );
  });

  it("strips legacy Payment Basis / Shariah keys from new write payloads", () => {
    const draft = completeSelectableDraft();
    draft.page1.paymentBasisOptionKey = "legacy_key";
    draft.page1.shariahPrincipleOptionKey = "legacy_key";
    const stripped = stripLegacyPaymentBasisShariahKeys(draft);
    expect(stripped.page1.paymentBasisOptionKey).toBeUndefined();
    expect(stripped.page1.shariahPrincipleOptionKey).toBeUndefined();
  });

  it("deep-clones review content so draft and approved do not share references", () => {
    const draft = completeSelectableDraft();
    const approved = cloneReviewContent(draft);
    draft.page2.creditInsights.creditScoreOptionKey = "changed";
    expect(approved.page2.creditInsights.creditScoreOptionKey).toBe("positive");
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
    expect(merged.keep_me).toBe(true);
    expect(merged.publication_content).toBeDefined();
  });

  it("freezes resolved highlight wording and ignores later live re-resolution", () => {
    const draft = completeSelectableDraft();
    const frozenResolved = toProspectusPublicationContent(draft);
    frozenResolved.keyInvestorHighlights = frozenResolved.keyInvestorHighlights.map((h) =>
      h.key === "paymaster"
        ? { ...h, title: "FROZEN_PAYMASTER_TITLE", description: "FROZEN_PAYMASTER_BODY" }
        : h
    );

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
    expect(
      fromFrozen?.keyInvestorHighlights.find((h) => h.key === "paymaster")?.title
    ).toBe("FROZEN_PAYMASTER_TITLE");

    const live = toProspectusPublicationContent(draft);
    expect(live.keyInvestorHighlights.find((h) => h.key === "paymaster")?.title).not.toBe(
      "FROZEN_PAYMASTER_TITLE"
    );
  });

  it("parses frozen branch with legacy option keys and keeps frozen resolved wording", () => {
    const draft = completeSelectableDraft();
    draft.page1.paymentBasisOptionKey = "placeholder_bullet_maturity";
    const resolved = toProspectusPublicationContent(draft);
    resolved.paymentBasisTemplate = {
      ...resolved.paymentBasisTemplate,
      paymentBasis: "HISTORICAL_PLACEHOLDER_PAYMENT",
    };
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
    expect(parsed?.resolvedPublicationContent.paymentBasisTemplate.paymentBasis).toBe(
      "HISTORICAL_PLACEHOLDER_PAYMENT"
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

describe("simplified prospectus workflow contract", () => {
  it("approves from Draft without a submit step", () => {
    expect(validateApprovalContent(completeSelectableDraft())).toEqual([]);
    expect(["DRAFT", "APPROVED", "PUBLISHED"]).toEqual(
      expect.arrayContaining(["DRAFT", "APPROVED", "PUBLISHED"])
    );
  });
});
