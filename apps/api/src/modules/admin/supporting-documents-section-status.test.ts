import { computeSupportingDocumentsSectionStatus } from "../applications/supporting-documents-section-status";

describe("computeSupportingDocumentsSectionStatus", () => {
  const twoKeys = ["supporting_documents:cat:0:a", "supporting_documents:cat:1:b"] as const;

  it("returns PENDING when there are no document keys", () => {
    expect(computeSupportingDocumentsSectionStatus([], [])).toBe("PENDING");
  });

  it("returns PENDING when a document has no row (missing key treated as PENDING)", () => {
    expect(
      computeSupportingDocumentsSectionStatus(twoKeys, [{ item_id: "supporting_documents:cat:0:a", status: "APPROVED" }])
    ).toBe("PENDING");
  });

  it("returns REJECTED if any item is rejected", () => {
    expect(
      computeSupportingDocumentsSectionStatus(twoKeys, [
        { item_id: "supporting_documents:cat:0:a", status: "REJECTED" },
        { item_id: "supporting_documents:cat:1:b", status: "APPROVED" },
      ])
    ).toBe("REJECTED");
  });

  it("returns PENDING if any item is still pending", () => {
    expect(
      computeSupportingDocumentsSectionStatus(twoKeys, [
        { item_id: "supporting_documents:cat:0:a", status: "APPROVED" },
        { item_id: "supporting_documents:cat:1:b", status: "PENDING" },
      ])
    ).toBe("PENDING");
  });

  it("returns APPROVED when all items approved", () => {
    expect(
      computeSupportingDocumentsSectionStatus(twoKeys, [
        { item_id: "supporting_documents:cat:0:a", status: "APPROVED" },
        { item_id: "supporting_documents:cat:1:b", status: "APPROVED" },
      ])
    ).toBe("APPROVED");
  });

  it("returns AMENDMENT_REQUESTED when all items decided and at least one amendment", () => {
    expect(
      computeSupportingDocumentsSectionStatus(twoKeys, [
        { item_id: "supporting_documents:cat:0:a", status: "APPROVED" },
        { item_id: "supporting_documents:cat:1:b", status: "AMENDMENT_REQUESTED" },
      ])
    ).toBe("AMENDMENT_REQUESTED");
  });
});
