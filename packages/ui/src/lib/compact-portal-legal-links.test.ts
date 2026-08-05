import type { PublicLegalDocumentResponse } from "@cashsouk/types";
import {
  buildCompactPortalLegalLinks,
  buildLandingFooterLegalLinks,
  buildPortalFooterLegalLinks,
  permanentCompactPortalLegalLinks,
  publicLegalDownloadApiPath,
  publicLegalViewApiPath,
} from "./compact-portal-legal-links";

function doc(
  partial: Partial<PublicLegalDocumentResponse> &
    Pick<PublicLegalDocumentResponse, "type" | "slug" | "title">
): PublicLegalDocumentResponse {
  return {
    legalDocumentId: partial.legalDocumentId ?? "ld1",
    legalDocumentVersionId: partial.legalDocumentVersionId ?? "ver1",
    type: partial.type,
    slug: partial.slug,
    title: partial.title,
    description: partial.description ?? null,
    audience: partial.audience ?? "BOTH",
    version: partial.version ?? 1,
    file_name: partial.file_name ?? "doc.pdf",
    published_at: partial.published_at ?? "2026-08-01T00:00:00.000Z",
  };
}

describe("buildCompactPortalLegalLinks", () => {
  it("has no permanent Legal Documents /legal link", () => {
    expect(permanentCompactPortalLegalLinks()).toEqual([]);
    expect(buildCompactPortalLegalLinks([])).toEqual([]);
  });

  it("shows Terms of Use with versionId when publicly available", () => {
    const links = buildCompactPortalLegalLinks([
      doc({
        type: "TERMS_OF_USE",
        slug: "terms-of-use",
        title: "Terms of Use",
        legalDocumentVersionId: "ver-terms",
      }),
    ]);
    expect(links).toEqual([
      {
        type: "TERMS_OF_USE",
        label: "Terms of Use",
        versionId: "ver-terms",
        title: "Terms of Use",
      },
    ]);
  });

  it("hides Terms of Use when unpublished / missing from public list", () => {
    expect(buildCompactPortalLegalLinks([]).map((l) => l.label)).toEqual([]);
  });

  it("shows PDPA only when publicly available", () => {
    const links = buildCompactPortalLegalLinks([
      doc({
        type: "PDPA_NOTICE_AND_CONSENT",
        slug: "pdpa-notice-and-consent",
        title: "PDPA Notice and Consent",
        legalDocumentVersionId: "ver-pdpa",
      }),
    ]);
    expect(links.map((l) => l.label)).toEqual(["PDPA"]);
    expect(links[0]?.versionId).toBe("ver-pdpa");
  });

  it("shows Risk Statement only when publicly available", () => {
    const links = buildCompactPortalLegalLinks([
      doc({
        type: "RISK_STATEMENT",
        slug: "risk-statement",
        title: "Risk Statement",
        legalDocumentVersionId: "ver-risk",
      }),
    ]);
    expect(links.map((l) => l.label)).toEqual(["Risk Statement"]);
  });

  it("does not create links from SiteDocument-style types", () => {
    const links = buildCompactPortalLegalLinks([
      doc({
        type: "RISK_DISCLOSURE" as never,
        slug: "risk-disclosure",
        title: "Risk Disclosure",
      }),
      doc({
        type: "PRIVACY_POLICY" as never,
        slug: "privacy-policy",
        title: "Privacy Policy",
      }),
    ]);
    expect(links).toEqual([]);
  });

  it("omits a document without a version id", () => {
    const links = buildCompactPortalLegalLinks([
      doc({
        type: "TERMS_OF_USE",
        slug: "terms-of-use",
        title: "Terms of Use",
        legalDocumentVersionId: "",
      }),
    ]);
    expect(links).toEqual([]);
  });

  it("shows all three when all are publicly available", () => {
    const links = buildCompactPortalLegalLinks([
      doc({
        type: "RISK_STATEMENT",
        slug: "risk-statement",
        title: "Risk Statement",
        legalDocumentVersionId: "v-risk",
      }),
      doc({
        type: "TERMS_OF_USE",
        slug: "terms-of-use",
        title: "Terms of Use",
        legalDocumentVersionId: "v-terms",
      }),
      doc({
        type: "PDPA_NOTICE_AND_CONSENT",
        slug: "pdpa-notice-and-consent",
        title: "PDPA",
        legalDocumentVersionId: "v-pdpa",
      }),
    ]);
    expect(links.map((l) => l.label)).toEqual([
      "Terms of Use",
      "PDPA",
      "Risk Statement",
    ]);
    expect(links.map((l) => l.versionId)).toEqual(["v-terms", "v-pdpa", "v-risk"]);
  });
});

describe("buildLandingFooterLegalLinks", () => {
  it("links PDPA, Terms, and Risk Statement by versionId", () => {
    const links = buildLandingFooterLegalLinks([
      doc({
        type: "PDPA_NOTICE_AND_CONSENT",
        slug: "pdpa",
        title: "PDPA Notice and Consent",
        legalDocumentVersionId: "ver-pdpa",
      }),
      doc({
        type: "TERMS_OF_USE",
        slug: "terms",
        title: "Terms of Use",
        legalDocumentVersionId: "ver-terms",
      }),
      doc({
        type: "RISK_STATEMENT",
        slug: "risk",
        title: "Risk Statement",
        legalDocumentVersionId: "ver-risk",
      }),
    ]);
    expect(links.find((l) => l.type === "PDPA_NOTICE_AND_CONSENT")?.versionId).toBe(
      "ver-pdpa"
    );
    expect(links.find((l) => l.type === "TERMS_OF_USE")?.versionId).toBe("ver-terms");
    expect(links.find((l) => l.type === "RISK_STATEMENT")?.versionId).toBe("ver-risk");
  });

  it("hides draft/archived/missing/non-public docs (absent from public list)", () => {
    expect(buildLandingFooterLegalLinks([])).toEqual([]);
  });
});

describe("public legal PDF API paths", () => {
  it("builds view and download endpoints without raw S3 URLs", () => {
    expect(publicLegalViewApiPath("abc", "https://api.example.com")).toBe(
      "https://api.example.com/v1/public/legal-documents/versions/abc/view"
    );
    expect(publicLegalDownloadApiPath("abc", "https://api.example.com/")).toBe(
      "https://api.example.com/v1/public/legal-documents/versions/abc/download"
    );
    expect(publicLegalViewApiPath("abc", "https://api.example.com")).not.toMatch(/s3/i);
  });
});

describe("buildPortalFooterLegalLinks", () => {
  it("shows audience-applicable published public docs for issuer", () => {
    const links = buildPortalFooterLegalLinks(
      [
        doc({
          type: "TERMS_OF_USE",
          slug: "terms-of-use",
          title: "Terms of Use",
          audience: "BOTH",
          legalDocumentVersionId: "v-terms",
        }),
        doc({
          type: "ISSUER_AGREEMENT",
          slug: "issuer-agreement",
          title: "Issuer Agreement",
          audience: "ISSUER",
          legalDocumentVersionId: "v-issuer",
        }),
        doc({
          type: "INVESTOR_AGREEMENT",
          slug: "investor-agreement",
          title: "Investor Agreement",
          audience: "INVESTOR",
          legalDocumentVersionId: "v-investor",
        }),
      ],
      "ISSUER"
    );
    expect(links.map((l) => l.type)).toEqual(["TERMS_OF_USE", "ISSUER_AGREEMENT"]);
    expect(links.map((l) => l.versionId)).toEqual(["v-terms", "v-issuer"]);
  });

  it("hides investor-only docs from issuer footer", () => {
    const links = buildPortalFooterLegalLinks(
      [
        doc({
          type: "INVESTOR_WARNING_STATEMENT",
          slug: "investor-warning-statement",
          title: "Investor Warning Statement",
          audience: "INVESTOR",
          legalDocumentVersionId: "v-warn",
        }),
      ],
      "ISSUER"
    );
    expect(links).toEqual([]);
  });
});
