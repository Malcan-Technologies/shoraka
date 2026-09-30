import {
  APPLICATION_REVIEWABLE_STATUSES,
  isApplicationReviewableStatus,
} from "./application-review-lifecycle";
import { isAdminFinancialEditOpen } from "./financial-field-resolution";

describe("application review lifecycle", () => {
  it("treats every listed status as reviewable", () => {
    for (const status of APPLICATION_REVIEWABLE_STATUSES) {
      expect(isApplicationReviewableStatus(status)).toBe(true);
    }
  });

  it.each(["DRAFT", "COMPLETED", "REJECTED", "WITHDRAWN", "ARCHIVED", "", null, undefined])(
    "treats %p as not reviewable",
    (status) => {
      expect(isApplicationReviewableStatus(status)).toBe(false);
    }
  );

  it("is case and whitespace tolerant", () => {
    expect(isApplicationReviewableStatus(" under_review ")).toBe(true);
  });
});

describe("isAdminFinancialEditOpen", () => {
  it("is open while reviewable and Financial is not approved", () => {
    for (const financialSectionStatus of ["PENDING", "AMENDMENT_REQUESTED", "REJECTED", null]) {
      expect(
        isAdminFinancialEditOpen({ financialSectionStatus, applicationStatus: "UNDER_REVIEW" })
      ).toBe(true);
    }
  });

  it("is closed once Financial is approved", () => {
    expect(
      isAdminFinancialEditOpen({
        financialSectionStatus: "APPROVED",
        applicationStatus: "AMENDMENT_REQUESTED",
      })
    ).toBe(false);
  });

  it.each(["DRAFT", "COMPLETED", "REJECTED", "WITHDRAWN", "ARCHIVED"])(
    "is closed on a %s application whatever the Financial row says",
    (applicationStatus) => {
      expect(
        isAdminFinancialEditOpen({ financialSectionStatus: "PENDING", applicationStatus })
      ).toBe(false);
    }
  );
});
