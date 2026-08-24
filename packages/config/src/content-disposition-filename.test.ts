import { parseContentDispositionFilename } from "./content-disposition-filename";

describe("parseContentDispositionFilename", () => {
  it("reads a quoted attachment filename", () => {
    expect(
      parseContentDispositionFilename(
        'attachment; filename="application-summary-APP-ARF-2026-0001.pdf"'
      )
    ).toBe("application-summary-APP-ARF-2026-0001.pdf");
  });

  it("prefers RFC 5987 filename*", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename=\"fallback.pdf\"; filename*=UTF-8''application-summary.pdf"
      )
    ).toBe("application-summary.pdf");
  });

  it("returns null when the header is missing", () => {
    expect(parseContentDispositionFilename(null)).toBeNull();
    expect(parseContentDispositionFilename("inline")).toBeNull();
  });
});
