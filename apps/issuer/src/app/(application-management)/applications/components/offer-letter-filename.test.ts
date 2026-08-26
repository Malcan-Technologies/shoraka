import { offerLetterDownloadFileName } from "./offer-letter-filename";

describe("offerLetterDownloadFileName", () => {
  it("uses the persisted canonical reference", () => {
    expect(offerLetterDownloadFileName("contract", "CON-ARF-202608-K71")).toBe(
      "contract-offer-CON-ARF-202608-K71.pdf"
    );
    expect(offerLetterDownloadFileName("invoice", "INV-ARF-202608-0N5")).toBe(
      "invoice-offer-INV-ARF-202608-0N5.pdf"
    );
  });

  it("falls back to letter when the canonical ref is missing", () => {
    expect(offerLetterDownloadFileName("invoice", null)).toBe("invoice-offer-letter.pdf");
    expect(offerLetterDownloadFileName("contract", "   ")).toBe("contract-offer-letter.pdf");
  });
});
