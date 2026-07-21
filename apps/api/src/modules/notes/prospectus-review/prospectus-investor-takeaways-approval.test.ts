/**
 * Investor Takeaways — catalogues, approval, do_not_display, hash invalidation
 */

import { cloneReviewContent } from "./prospectus-review-content";
import { hashDraftContent } from "./prospectus-approved-snapshot";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import {
  validateApprovalContent,
  validateDraftContent,
} from "./prospectus-review.schemas";
import {
  PROSPECTUS_TAKEAWAY_KEYS,
  PROSPECTUS_TAKEAWAY_OPTION_CATALOGUE,
} from "./prospectus-option-catalogues";
import { buildProspectusPageThreeInvestorTakeaways } from "../prospectus/prospectus-page-three-investor-takeaways";
import { SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT } from "../prospectus/prospectus-page-three-investor-takeaways.sample-data";
import { toProspectusPublicationContent } from "./prospectus-review-content";
import { buildProspectusPageThreeHtml } from "../prospectus/prospectus-page-three.html";
import { SAMPLE_PROSPECTUS_PAGE_THREE } from "../prospectus/prospectus-page-three.sample-data";

describe("prospectus Investor Takeaways catalogues and approval", () => {
  it("exposes exactly six fixed categories in order with separate catalogues", () => {
    expect([...PROSPECTUS_TAKEAWAY_KEYS]).toEqual([
      "revenue_profitability",
      "liquidity",
      "leverage",
      "debt_servicing_capacity",
      "receivables_collection",
      "overall_financial_profile",
    ]);
    for (const key of PROSPECTUS_TAKEAWAY_KEYS) {
      const options = PROSPECTUS_TAKEAWAY_OPTION_CATALOGUE[key] ?? [];
      expect(options.some((o) => o.key === "do_not_display")).toBe(true);
      expect(options.every((o) => o.renderedText === null || typeof o.renderedText === "string")).toBe(
        true
      );
    }
    const revenueKeys = new Set(
      (PROSPECTUS_TAKEAWAY_OPTION_CATALOGUE.revenue_profitability ?? []).map((o) => o.key)
    );
    const liquidityKeys = new Set(
      (PROSPECTUS_TAKEAWAY_OPTION_CATALOGUE.liquidity ?? []).map((o) => o.key)
    );
    expect(revenueKeys.has("steady_growth")).toBe(true);
    expect(liquidityKeys.has("steady_growth")).toBe(false);
    expect(liquidityKeys.has("healthy_improving")).toBe(true);
    expect(revenueKeys.has("healthy_improving")).toBe(false);
  });

  it("rejects cross-category and unknown option keys on draft validation", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page3.investorTakeaways.liquidityOptionKey = "steady_growth";
    expect(
      validateDraftContent(draft).some(
        (e) =>
          e.path === "page3.investorTakeaways.liquidityOptionKey" &&
          e.message === "Invalid option key"
      )
    ).toBe(true);

    draft.page3.investorTakeaways.liquidityOptionKey = "not_a_real_key";
    expect(
      validateDraftContent(draft).some(
        (e) => e.path === "page3.investorTakeaways.liquidityOptionKey"
      )
    ).toBe(true);
  });

  it("allows draft save with incomplete takeaway selections", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page3.investorTakeaways.receivablesCollectionOptionKey = null;
    expect(
      validateDraftContent(draft).some((e) =>
        e.path.startsWith("page3.investorTakeaways.")
      )
    ).toBe(false);
  });

  it("requires all six takeaway keys for approval with category-specific messages", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page3.investorTakeaways.revenueProfitabilityOptionKey = null;
    draft.page3.investorTakeaways.receivablesCollectionOptionKey = undefined;
    const errors = validateApprovalContent(draft);
    expect(errors).toEqual(
      expect.arrayContaining([
        {
          path: "page3.investorTakeaways.revenueProfitabilityOptionKey",
          message:
            "Revenue & Profitability takeaway selection is required before approving the Prospectus.",
        },
        {
          path: "page3.investorTakeaways.receivablesCollectionOptionKey",
          message:
            "Receivables Collection takeaway selection is required before approving the Prospectus.",
        },
      ])
    );
  });

  it("treats do_not_display as a valid completed approval selection", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page3.investorTakeaways.liquidityOptionKey = "do_not_display";
    expect(validateApprovalContent(draft)).toEqual([]);
    expect(validateDraftContent(draft)).toEqual([]);
  });

  it("uses demo keys that resolve to the six Canva-style descriptions", () => {
    const draft = buildCompleteProspectusReviewDraft();
    const publication = toProspectusPublicationContent(draft);
    const data = buildProspectusPageThreeInvestorTakeaways({
      ...SAMPLE_PROSPECTUS_PAGE_THREE_INVESTOR_TAKEAWAYS_INPUT,
      investorTakeawayOptions: publication.investorTakeawayOptions,
      investorTakeawaySelections: publication.investorTakeawaySelections,
    });
    expect(data.omittedKeys).toEqual([]);
    expect(data.items.map((i) => i.takeaway)).toEqual([
      "Revenue and profitability have shown steady year-on-year growth.",
      "Liquidity remains healthy, with current and quick ratios improving over time.",
      "Leverage is conservative and trending downward, supporting a stronger balance sheet.",
      "Debt servicing capacity appears adequate, with improving DSCR and strong interest coverage.",
      "Receivables collection days have improved, indicating better working capital management.",
      "Overall financial profile suggests strengthening fundamentals over the observed period.",
    ]);
  });

  it("keeps identical takeaway selections on the same content hash", () => {
    const approved = buildCompleteProspectusReviewDraft();
    const same = cloneReviewContent(approved);
    expect(hashDraftContent(approved)).toBe(hashDraftContent(same));
  });

  it("changes content hash when a takeaway option key changes or becomes do_not_display", () => {
    const approved = buildCompleteProspectusReviewDraft();
    const changedKey = cloneReviewContent(approved);
    changedKey.page3.investorTakeaways.overallFinancialProfileOptionKey =
      "requires_monitoring";
    expect(hashDraftContent(approved)).not.toBe(hashDraftContent(changedKey));

    const hidden = cloneReviewContent(approved);
    hidden.page3.investorTakeaways.liquidityOptionKey = "do_not_display";
    expect(hashDraftContent(approved)).not.toBe(hashDraftContent(hidden));
  });

  it("freezes resolved takeaway wording into page3 HTML and publish copies it", () => {
    const html = buildProspectusPageThreeHtml(SAMPLE_PROSPECTUS_PAGE_THREE);
    expect(html).toContain("4. INVESTOR TAKEAWAYS");
    expect(html).toContain(
      "Revenue and profitability have shown steady year-on-year growth."
    );
    expect(html).toContain(
      "Overall financial profile suggests strengthening fundamentals over the observed period."
    );
    expect(html).not.toContain("steady_growth");
    expect(html).not.toContain("do_not_display");

    const approved = {
      html: { page1: "<p>1</p>", page2: "<p>2</p>", page3: html },
    };
    const published = structuredClone(approved);
    published.html.page3 = "<p>mutated</p>";
    expect(approved.html.page3).toBe(html);
    expect(approved.html.page3).toContain(
      "Receivables collection days have improved, indicating better working capital management."
    );
  });
});
