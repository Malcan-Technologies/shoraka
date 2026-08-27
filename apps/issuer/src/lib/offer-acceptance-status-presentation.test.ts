import { getOfferAcceptanceStatusPresentation } from "@cashsouk/types";

// Cosmetic-copy regression test: locks in the canonical "for" (lowercase preposition)
// casing from docs/audit/activity-notification-copy-standard.md §2, matching the
// "Facility/Invoice Acceptance Approved for Signing" wording used elsewhere in the product.
describe("getOfferAcceptanceStatusPresentation", () => {
  it("uses the canonical lowercase preposition for APPROVED_FOR_SIGNING", () => {
    expect(getOfferAcceptanceStatusPresentation("APPROVED_FOR_SIGNING")).toEqual({
      label: "Approved for Signing",
    });
  });

  it("does not change the meaning or casing of other offer-acceptance phase labels", () => {
    expect(getOfferAcceptanceStatusPresentation("PENDING_ISSUER").label).toBe("Pending Issuer");
    expect(getOfferAcceptanceStatusPresentation("PENDING_ADMIN_REVIEW").label).toBe(
      "Pending Review"
    );
    expect(getOfferAcceptanceStatusPresentation("CHANGES_REQUESTED").label).toBe(
      "Changes Requested"
    );
    expect(getOfferAcceptanceStatusPresentation("SIGNING_IN_PROGRESS").label).toBe(
      "Signing In Progress"
    );
    expect(getOfferAcceptanceStatusPresentation("COMPLETED").label).toBe("Completed");
  });
});
