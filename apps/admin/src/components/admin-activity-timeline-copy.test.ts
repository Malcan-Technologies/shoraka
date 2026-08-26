import { readFileSync } from "node:fs";
import { join } from "node:path";

// Cosmetic-copy regression: canonical sentence case for signing-package events
// (docs/audit/activity-notification-copy-standard.md §3), matching the facility/invoice
// timeline and CSV surfaces. Source-text assertion (rather than component rendering) since
// `getEventLabel`'s label map is a module-private constant.
describe("admin activity timeline signing-package copy", () => {
  const source = readFileSync(join(__dirname, "admin-activity-timeline.tsx"), "utf8");

  it("uses Title Case for Signing Package Created (copy standardization) and sentence-case for the rest", () => {
    expect(source).toMatch(/SIGNING_PACKAGE_CREATED:\s*"Signing Package Created"/);
    expect(source).toMatch(/SIGNING_PACKAGE_SENT:\s*"Signing package sent"/);
    expect(source).toMatch(/SIGNING_PACKAGE_VOIDED:\s*"Signing package voided"/);
  });

  it("shows SIGNING_PACKAGE_COMPLETED as a real timeline event", () => {
    expect(source).toMatch(/SIGNING_PACKAGE_COMPLETED:\s*"Signing Package Completed"/);
    expect(source).not.toContain("TIMELINE_HIDDEN_EVENT_TYPES");
  });

  it("labels AMENDMENTS_SUBMITTED as CashSouk sending the request, not the issuer submitting", () => {
    expect(source).toMatch(/AMENDMENTS_SUBMITTED:\s*"Amendment Request Sent"/);
    expect(source).toMatch(/APPLICATION_RESUBMITTED:\s*"Application Resubmitted"/);
    expect(source).not.toMatch(/AMENDMENTS_SUBMITTED:\s*"Amendments Submitted"/);
    expect(source).not.toMatch(/You submitted amendments/i);
    expect(source).not.toMatch(/The issuer submitted amendments/i);
  });

  it("keeps the canonical Acceptance Approved for Signing wording (already correct)", () => {
    expect(source).toMatch(
      /CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING:\s*"Facility Acceptance Approved for Signing"/
    );
    expect(source).toMatch(
      /INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING:\s*"Invoice Acceptance Approved for Signing"/
    );
  });
});
