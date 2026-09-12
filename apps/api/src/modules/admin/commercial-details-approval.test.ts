import * as fs from "fs";
import * as path from "path";

const SERVICE = fs.readFileSync(path.join(__dirname, "service.ts"), "utf8");

describe("commercial details approval before send offer", () => {
  it("allows admin invoice and facility details approve, and blocks send until then", () => {
    expect(SERVICE).not.toContain("Invoice approvals must be finalized by issuer offer response");
    expect(SERVICE).not.toContain(
      "Facility and invoice approvals must be finalized by issuer offer response"
    );
    expect(SERVICE).toContain("Approve facility details before sending an offer");
    expect(SERVICE).toContain("Approve invoice details before sending an offer");
    expect(SERVICE).toContain(
      "Invoice section status is derived from per-invoice reviews; approve each invoice instead"
    );
    expect(SERVICE).toContain("assertCommercialDetailsApprovedForSend");
    expect(SERVICE).toContain("isCommercialOfferSendUnlocked");
    expect(SERVICE).toContain("assertReviewSectionPrerequisites");
    expect(SERVICE).toContain("assertReviewItemPrerequisites");
    expect(SERVICE).toContain("assertLockedReviewSectionPrerequisites");
    expect(SERVICE).toContain("FROM application_reviews");
    expect(SERVICE).toContain("AND section::text IN");
    expect(SERVICE).toContain("FROM application_review_items");
    expect(SERVICE).toContain("Complete previous review sections before this action");
    expect(SERVICE).toContain("ITEM_REVIEWED_");
    expect(SERVICE).toContain("SECTION_REVIEWED_");
    expect(SERVICE).toContain(
      "Invoice was rejected; reset review to pending before continuing"
    );
    expect(SERVICE).toContain("productIdFromFinancingType");
    expect(SERVICE).toContain("assertReviewSectionPrerequisites(application, scopeKey as ReviewSection)");
    expect(SERVICE).toContain("assertReviewItemPrerequisites(application, itemType, itemId)");
  });

  it("syncs invoice_details from items after invoice item approve, matching reject/amend/reset", () => {
    const approveBody = SERVICE.slice(
      SERVICE.indexOf("async approveReviewItem("),
      SERVICE.indexOf("async rejectReviewItem(")
    );
    expect(approveBody).toContain("syncInvoiceDetailsSectionFromItems");
    expect(approveBody).toContain("syncAdminStageStatus");
    expect(approveBody.indexOf("syncInvoiceDetailsSectionFromItems")).toBeLessThan(
      approveBody.indexOf("syncAdminStageStatus")
    );
  });
});
