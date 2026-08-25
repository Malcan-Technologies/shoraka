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

  it("does not add SIGNING_PACKAGE_COMPLETED to the visible label map (stays hidden by design)", () => {
    expect(source).not.toMatch(/SIGNING_PACKAGE_COMPLETED:\s*"/);
    expect(source).toMatch(/TIMELINE_HIDDEN_EVENT_TYPES = new Set\(\["SIGNING_PACKAGE_COMPLETED"\]\)/);
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
