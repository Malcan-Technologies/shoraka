import type { AuthorizedPartiesSnapshot } from "@cashsouk/types";
import { filterAcceptanceReviewItemsForOffer } from "./acceptance-review-scope";

const invoiceBParties: AuthorizedPartiesSnapshot = {
  submitted_by_user_id: "admin",
  submitted_at: "2026-09-01T00:00:00.000Z",
  parties: [
    {
      key: "issuer",
      entity_kind: "ISSUER",
      representatives: [],
    },
    {
      key: "g_b",
      entity_kind: "CORPORATE_GUARANTOR",
      application_guarantor_id: "b",
      client_guarantor_id: "b",
      representatives: [],
    },
  ],
};

describe("filterAcceptanceReviewItemsForOffer", () => {
  const items = [
    { item_id: "acceptance_documents:0:board_resolution", status: "APPROVED" },
    { item_id: "authorized_representatives:issuer", status: "APPROVED" },
    { item_id: "authorized_representatives:guarantor:a", status: "PENDING" },
    { item_id: "authorized_representatives:guarantor:b", status: "APPROVED" },
  ];

  it("keeps shared documents and only the selected offer's party rows", () => {
    expect(filterAcceptanceReviewItemsForOffer(items, invoiceBParties)).toEqual([
      { item_id: "acceptance_documents:0:board_resolution", status: "APPROVED" },
      { item_id: "authorized_representatives:issuer", status: "APPROVED" },
      { item_id: "authorized_representatives:guarantor:b", status: "APPROVED" },
    ]);
  });

  it("leaves items unchanged when the offer has no party snapshot", () => {
    expect(filterAcceptanceReviewItemsForOffer(items, null)).toEqual(items);
  });
});
