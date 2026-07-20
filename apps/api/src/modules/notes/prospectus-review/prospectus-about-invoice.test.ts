/**
 * About the Invoice / Work Performed — KIH-style normalize + publication resolve.
 */

import {
  PROSPECTUS_ABOUT_INVOICE_ITEM_IDS,
  PROSPECTUS_ABOUT_INVOICE_SUGGESTIONS,
} from "@cashsouk/types";
import {
  emptyProspectusReviewContent,
  normalizeAboutInvoiceSelections,
  toProspectusPublicationContent,
} from "./prospectus-review-content";
import { validateApprovalContent } from "./prospectus-review.schemas";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";

describe("prospectus about invoice (KIH-style)", () => {
  it("pre-fills four SYSTEM_SUGGESTION templates on empty content", () => {
    const empty = emptyProspectusReviewContent();
    expect(empty.page2.aboutInvoice?.items).toHaveLength(4);
    expect(empty.page2.aboutInvoice?.items.every((i) => i.sourceType === "SYSTEM_SUGGESTION")).toBe(
      true
    );
    expect(empty.page2.aboutInvoice?.items.map((i) => i.id)).toEqual([
      ...PROSPECTUS_ABOUT_INVOICE_ITEM_IDS,
    ]);
    expect(empty.page2.aboutInvoice?.items[0]?.text).toBe(
      PROSPECTUS_ABOUT_INVOICE_SUGGESTIONS.work_under_contract.text
    );
  });

  it("migrates legacy catalogue optionKey rows into aboutInvoice text", () => {
    const legacy = emptyProspectusReviewContent();
    delete legacy.page2.aboutInvoice;
    legacy.page2.invoiceWorkStatements = [
      {
        key: "work_under_contract",
        optionKey: "placeholder_work_under_contract",
        isVisible: true,
      },
      {
        key: "certification_acceptance",
        optionKey: "do_not_display",
        isVisible: false,
      },
      {
        key: "paymaster_trust_account",
        optionKey: null,
        isVisible: true,
      },
      {
        key: "deed_of_assignment",
        optionKey: "placeholder_deed_of_assignment",
        isVisible: true,
      },
    ];
    const normalized = normalizeAboutInvoiceSelections(legacy);
    const byId = new Map(normalized.page2.aboutInvoice!.items.map((i) => [i.id, i]));
    expect(byId.get("work_under_contract")?.sourceType).toBe("OFFICER_ENTERED");
    expect(byId.get("work_under_contract")?.text).toContain("work under contract");
    expect(byId.get("certification_acceptance")?.sourceType).toBe("SYSTEM_SUGGESTION");
    expect(byId.get("deed_of_assignment")?.sourceType).toBe("OFFICER_ENTERED");
  });

  it("publishes officer text into Page 2 builder statements", () => {
    const draft = buildCompleteProspectusReviewDraft();
    const publication = toProspectusPublicationContent(draft);
    expect(publication.invoiceWorkStatements).toHaveLength(4);
    expect(publication.invoiceWorkStatements.every((s) => s.isVisible && s.text.trim())).toBe(
      true
    );
    expect(publication.invoiceWorkStatements.every((s) => s.sourceType === "placeholder_manual")).toBe(
      true
    );
  });

  it("requires non-empty aboutInvoice text for approval", () => {
    const draft = buildCompleteProspectusReviewDraft();
    draft.page2.aboutInvoice = {
      items: PROSPECTUS_ABOUT_INVOICE_ITEM_IDS.map((id) => ({
        id,
        text: "",
        sourceType: "SYSTEM_SUGGESTION" as const,
      })),
    };
    expect(
      validateApprovalContent(draft).some((e) => e.path.includes("aboutInvoice"))
    ).toBe(true);
  });
});
