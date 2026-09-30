import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isAdminFinancialEditOpen } from "@cashsouk/types";

const read = (relative: string) => readFileSync(join(__dirname, relative), "utf8");
const content = read("application-financial-review-content.tsx");
const financialSection = read("application-review/sections/financial-section.tsx");
const sectionContent = read("application-review/section-content.tsx");
const reviewPage = read("../app/applications/[productKey]/[id]/page.tsx");

describe("Financial tab edit lock follows the application review boundary", () => {
  it("locks Add / Edit from the shared helper, not the section status alone", () => {
    expect(content).toContain(
      "const financialEditsLocked = !isAdminFinancialEditOpen({ financialSectionStatus, applicationStatus });"
    );
    expect(content).not.toContain("isAdminFinancialReviewEditLocked(");
  });

  it("passes the live application status down to the Financial tab", () => {
    expect(sectionContent).toContain("applicationStatus={app.status}");
    expect(financialSection).toContain("applicationStatus={applicationStatus}");
  });

  it("explains a closed application before the approved section", () => {
    const closedAt = content.indexOf('? "Application is no longer under review"');
    const approvedAt = content.indexOf('? "Financial review is approved"');
    expect(closedAt).toBeGreaterThan(-1);
    expect(approvedAt).toBeGreaterThan(closedAt);
  });

  it("uses the shared reviewable status list on the review page", () => {
    expect(reviewPage).toContain("isApplicationReviewableStatus(app.status)");
    expect(reviewPage).not.toContain("REVIEWABLE_STATUSES");
  });

  it.each([
    ["UNDER_REVIEW", "PENDING", true],
    ["AMENDMENT_REQUESTED", "AMENDMENT_REQUESTED", true],
    ["UNDER_REVIEW", "REJECTED", true],
    ["UNDER_REVIEW", null, true],
    ["UNDER_REVIEW", "APPROVED", false],
    ["AMENDMENT_REQUESTED", "APPROVED", false],
    ["COMPLETED", "PENDING", false],
    ["REJECTED", "PENDING", false],
    ["WITHDRAWN", "PENDING", false],
    ["ARCHIVED", "PENDING", false],
    ["DRAFT", "PENDING", false],
  ])("application %s with Financial %s is open: %s", (applicationStatus, financialSectionStatus, open) => {
    expect(isAdminFinancialEditOpen({ applicationStatus, financialSectionStatus })).toBe(open);
  });
});
