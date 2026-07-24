import {
  getAcceptanceDocumentsPrerequisites,
  getReviewSectionOrder,
  getReviewSectionPrerequisites,
  getSectionSortIndex,
  isPrerequisiteSectionSatisfied,
  REVIEW_SECTION_ORDER,
  REVIEW_SECTION_ORDER_INVOICE_ONLY,
} from "@cashsouk/types";

describe("getReviewSectionOrder", () => {
  it("keeps Acceptance before Invoice for contract / default", () => {
    expect(getReviewSectionOrder("new_contract")).toEqual([...REVIEW_SECTION_ORDER]);
    expect(getReviewSectionOrder("existing_contract")).toEqual([...REVIEW_SECTION_ORDER]);
    expect(getReviewSectionOrder(null)).toEqual([...REVIEW_SECTION_ORDER]);
    expect(getReviewSectionOrder(undefined)).toEqual([...REVIEW_SECTION_ORDER]);

    const order = getReviewSectionOrder("new_contract");
    expect(order.indexOf("acceptance_documents")).toBeLessThan(order.indexOf("invoice_details"));
  });

  it("places Invoice before Acceptance for invoice_only", () => {
    expect(getReviewSectionOrder("invoice_only")).toEqual([...REVIEW_SECTION_ORDER_INVOICE_ONLY]);

    const order = getReviewSectionOrder("invoice_only");
    expect(order.indexOf("invoice_details")).toBeLessThan(order.indexOf("acceptance_documents"));
    expect(order.indexOf("contract_details")).toBeLessThan(order.indexOf("invoice_details"));
  });
});

describe("getAcceptanceDocumentsPrerequisites", () => {
  it("requires Contract for contract flows", () => {
    expect(getAcceptanceDocumentsPrerequisites("new_contract")).toEqual([
      "financial",
      "company_details",
      "business_details",
      "supporting_documents",
      "contract_details",
    ]);
  });

  it("requires Invoice (and Customer) for invoice_only", () => {
    expect(getAcceptanceDocumentsPrerequisites("invoice_only")).toEqual([
      "financial",
      "company_details",
      "business_details",
      "supporting_documents",
      "contract_details",
      "invoice_details",
    ]);
  });
});

describe("getReviewSectionPrerequisites", () => {
  it("includes acceptance_documents for both structures", () => {
    expect(getReviewSectionPrerequisites("new_contract").acceptance_documents).toEqual(
      getAcceptanceDocumentsPrerequisites("new_contract")
    );
    expect(getReviewSectionPrerequisites("invoice_only").acceptance_documents).toEqual(
      getAcceptanceDocumentsPrerequisites("invoice_only")
    );
  });
});

describe("getSectionSortIndex", () => {
  it("is structure-aware for acceptance vs invoice", () => {
    expect(getSectionSortIndex("acceptance_documents", "new_contract")).toBeLessThan(
      getSectionSortIndex("invoice_details", "new_contract")
    );
    expect(getSectionSortIndex("invoice_details", "invoice_only")).toBeLessThan(
      getSectionSortIndex("acceptance_documents", "invoice_only")
    );
  });
});

describe("isPrerequisiteSectionSatisfied", () => {
  it("treats APPROVED as satisfied for any dependent", () => {
    expect(isPrerequisiteSectionSatisfied("financial", "APPROVED", "acceptance_documents")).toBe(
      true
    );
    expect(isPrerequisiteSectionSatisfied("contract_details", "APPROVED", "invoice_details")).toBe(
      true
    );
  });

  it("treats Contract/Invoice OFFER_SENT as satisfied only for Acceptance", () => {
    expect(
      isPrerequisiteSectionSatisfied("contract_details", "OFFER_SENT", "acceptance_documents")
    ).toBe(true);
    expect(
      isPrerequisiteSectionSatisfied("invoice_details", "OFFER_SENT", "acceptance_documents")
    ).toBe(true);
    expect(isPrerequisiteSectionSatisfied("contract_details", "OFFER_SENT", "invoice_details")).toBe(
      false
    );
    expect(isPrerequisiteSectionSatisfied("financial", "OFFER_SENT", "acceptance_documents")).toBe(
      false
    );
  });

  it("treats Contract/Invoice OFFER_EXPIRED as satisfied for Acceptance", () => {
    expect(
      isPrerequisiteSectionSatisfied("contract_details", "OFFER_EXPIRED", "acceptance_documents")
    ).toBe(true);
    expect(
      isPrerequisiteSectionSatisfied("invoice_details", "OFFER_EXPIRED", "acceptance_documents")
    ).toBe(true);
  });

  it("rejects PENDING and missing status", () => {
    expect(
      isPrerequisiteSectionSatisfied("contract_details", "PENDING", "acceptance_documents")
    ).toBe(false);
    expect(
      isPrerequisiteSectionSatisfied("contract_details", undefined, "acceptance_documents")
    ).toBe(false);
  });
});
