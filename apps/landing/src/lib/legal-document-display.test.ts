import {
  buildPublicLegalMetadataLine,
  formatPublicLegalPublishedDate,
  publicLegalDownloadPath,
  publicLegalViewPath,
  resolvePublicLegalDescription,
  resolvePublicLegalTitle,
} from "./legal-document-display";

describe("public legal document display helpers", () => {
  it("renders a valid document title", () => {
    expect(
      resolvePublicLegalTitle({
        type: "PDPA_NOTICE_AND_CONSENT",
        title: "PDPA Notice and Consent",
      })
    ).toBe("PDPA Notice and Consent");
  });

  it("falls back to document-type label for invalid or placeholder titles", () => {
    expect(resolvePublicLegalTitle({ type: "TERMS_OF_USE", title: "t" })).toBe("Terms of Use");
    expect(resolvePublicLegalTitle({ type: "RISK_STATEMENT", title: "  " })).toBe("Risk Statement");
    expect(resolvePublicLegalTitle({ type: "ISSUER_AGREEMENT", title: "test" })).toBe(
      "Issuer Agreement"
    );
  });

  it("renders a meaningful description", () => {
    const text =
      "This notice explains how CashSouk collects, uses, stores and discloses personal data.";
    expect(resolvePublicLegalDescription(text)).toBe(text);
  });

  it("hides empty or placeholder descriptions", () => {
    expect(resolvePublicLegalDescription("a")).toBeNull();
    expect(resolvePublicLegalDescription("")).toBeNull();
    expect(resolvePublicLegalDescription("   ")).toBeNull();
    expect(resolvePublicLegalDescription("test")).toBeNull();
    expect(resolvePublicLegalDescription("Too short")).toBeNull();
  });

  it("formats published dates in a public-friendly form", () => {
    expect(formatPublicLegalPublishedDate("2026-08-03T10:15:30.000Z")).toBe("3 August 2026");
  });

  it("builds a muted version/date metadata line", () => {
    expect(
      buildPublicLegalMetadataLine({
        version: 1,
        publishedAt: "2026-08-03T00:00:00.000Z",
      })
    ).toBe("Version 1 · Published 3 August 2026");
  });

  it("points View PDF and Download PDF to public endpoints", () => {
    expect(publicLegalViewPath("ver-1", "http://localhost:4000")).toBe(
      "http://localhost:4000/v1/public/legal-documents/versions/ver-1/view"
    );
    expect(publicLegalDownloadPath("ver-1", "http://localhost:4000/")).toBe(
      "http://localhost:4000/v1/public/legal-documents/versions/ver-1/download"
    );
  });
});
