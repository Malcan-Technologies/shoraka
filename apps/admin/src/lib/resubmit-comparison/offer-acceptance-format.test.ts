jest.mock("@cashsouk/config", () => ({
  ...jest.requireActual("@cashsouk/config/src/currency"),
  ...jest.requireActual("@cashsouk/config/src/offer-resolvers"),
}));

import {
  REVIEW_EMPTY_LABEL,
  formatFileSize,
  formatReviewDate,
  formatReviewValue,
} from "@/components/application-review/review-section-styles";
import {
  fileDocToComparisonFiles,
  formatOfferAcceptanceDate,
  formatOfferAcceptanceMoney,
  invoiceTabLabel,
  offerAcceptanceTriBool,
} from "./offer-acceptance-format";
import {
  REVIEW_EMPTY_LABEL as SHARED_EMPTY_LABEL,
  formatFileSize as sharedFormatFileSize,
  formatReviewDate as sharedFormatReviewDate,
  formatReviewText,
  unknownToTriBool,
} from "./shared-format";

/** The UI modules re-export the pure helpers, so live review fields and projections print the same. */
describe("shared-format helpers re-exported by the review UI modules", () => {
  it("UI modules re-export the pure implementations", () => {
    expect(REVIEW_EMPTY_LABEL).toBe(SHARED_EMPTY_LABEL);
    expect(formatFileSize).toBe(sharedFormatFileSize);
    expect(formatReviewDate).toBe(sharedFormatReviewDate);
    expect(offerAcceptanceTriBool).toBe(unknownToTriBool);
  });

  it.each([null, undefined, "", "  ", " abc ", 0, 12.5, Number.NaN, true])(
    "formatReviewText(%p) matches formatReviewValue",
    (v) => {
      expect(formatReviewText(v)).toBe(formatReviewValue(v));
    }
  );

  it("formats review dates (dd MMM yyyy, raw string when unparsable, empty label)", () => {
    expect(formatReviewDate("2026-01-15")).toBe("15 Jan 2026");
    expect(formatReviewDate("not a date")).toBe("not a date");
    expect(formatReviewDate(null)).toBe("Not provided");
    expect(formatReviewDate("", { emptyLabel: "—" })).toBe("—");
  });

  it.each([null, undefined, "", "2026-01-15", "2026-01-15T10:00:00Z", "not a date"])(
    "formatOfferAcceptanceDate(%p) matches formatReviewDate",
    (v) => {
      expect(formatOfferAcceptanceDate(v)).toBe(formatReviewDate(v));
    }
  );

  it("formats file sizes as B, KB or MB", () => {
    expect(formatFileSize(10)).toBe("10 B");
    expect(formatFileSize(2048)).toBe("2.00 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.00 MB");
  });

  it("maps yes/no tri-state", () => {
    expect([true, "yes", false, "no", null, "maybe"].map(unknownToTriBool)).toEqual([
      true,
      true,
      false,
      false,
      null,
      null,
    ]);
  });
});

describe("offer-acceptance-format helpers", () => {
  it("prints numeric strings and numbers as the same currency", () => {
    expect(formatOfferAcceptanceMoney("1000")).toBe(formatOfferAcceptanceMoney(1000));
    expect(formatOfferAcceptanceMoney("abc")).toBe("abc");
    expect(formatOfferAcceptanceMoney(null)).toBe(REVIEW_EMPTY_LABEL);
  });

  it("maps a document to file refs (Attached file fallback, size secondary)", () => {
    expect(fileDocToComparisonFiles(undefined)).toEqual([]);
    expect(fileDocToComparisonFiles({ s3_key: " " })).toEqual([]);
    expect(fileDocToComparisonFiles({ s3_key: "k", file_size: 2048 })).toEqual([
      { s3Key: "k", fileName: "Attached file", secondary: "2.00 KB" },
    ]);
  });

  it("labels invoices by display reference, then number", () => {
    expect(invoiceTabLabel({ displayReference: "INV-REF", details: { number: "9" } })).toBe(
      "INV-REF"
    );
    expect(invoiceTabLabel({ details: { number: "9" } })).toBe("9");
    expect(invoiceTabLabel({ details: {} })).toBe("Invoice");
  });
});
