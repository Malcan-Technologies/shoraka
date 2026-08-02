import type { PublicLegalDocumentResponse } from "@cashsouk/types";
import {
  buildCompactPortalLegalLinks,
  permanentCompactPortalLegalLinks,
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
  it("always includes Legal Documents", () => {
    expect(permanentCompactPortalLegalLinks()).toEqual([
      { label: "Legal Documents", path: "/legal", permanent: true },
    ]);
    expect(buildCompactPortalLegalLinks([])[0]).toMatchObject({
      label: "Legal Documents",
      path: "/legal",
      permanent: true,
    });
  });

  it("shows Terms of Use when a published public Terms document exists", () => {
    const links = buildCompactPortalLegalLinks([
      doc({ type: "TERMS_OF_USE", slug: "terms-of-use", title: "Terms of Use" }),
    ]);
    expect(links.map((l) => l.label)).toEqual(["Legal Documents", "Terms of Use"]);
    expect(links[1]?.path).toBe("/legal/terms-of-use");
  });

  it("hides Terms of Use when unpublished / missing from public list", () => {
    const links = buildCompactPortalLegalLinks([]);
    expect(links.map((l) => l.label)).toEqual(["Legal Documents"]);
  });

  it("shows PDPA only when publicly available", () => {
    const links = buildCompactPortalLegalLinks([
      doc({
        type: "PDPA_NOTICE_AND_CONSENT",
        slug: "pdpa-notice-and-consent",
        title: "PDPA Notice and Consent",
      }),
    ]);
    expect(links.map((l) => l.label)).toEqual(["Legal Documents", "PDPA"]);
    expect(links[1]?.path).toBe("/legal/pdpa-notice-and-consent");
  });

  it("shows Risk Statement only when publicly available", () => {
    const links = buildCompactPortalLegalLinks([
      doc({ type: "RISK_STATEMENT", slug: "risk-statement", title: "Risk Statement" }),
    ]);
    expect(links.map((l) => l.label)).toEqual(["Legal Documents", "Risk Statement"]);
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
    expect(links.map((l) => l.label)).toEqual(["Legal Documents"]);
  });

  it("uses API slug and ignores hard-coded fallbacks for missing docs", () => {
    const links = buildCompactPortalLegalLinks([
      doc({ type: "TERMS_OF_USE", slug: "custom-terms-slug", title: "Terms" }),
    ]);
    expect(links.find((l) => l.label === "Terms of Use")?.path).toBe(
      "/legal/custom-terms-slug"
    );
  });

  it("omits a document without a slug", () => {
    const links = buildCompactPortalLegalLinks([
      doc({ type: "TERMS_OF_USE", slug: "", title: "Terms of Use" }),
    ]);
    expect(links.map((l) => l.label)).toEqual(["Legal Documents"]);
  });

  it("shows all three when all are publicly available", () => {
    const links = buildCompactPortalLegalLinks([
      doc({ type: "RISK_STATEMENT", slug: "risk-statement", title: "Risk Statement" }),
      doc({ type: "TERMS_OF_USE", slug: "terms-of-use", title: "Terms of Use" }),
      doc({
        type: "PDPA_NOTICE_AND_CONSENT",
        slug: "pdpa-notice-and-consent",
        title: "PDPA",
      }),
    ]);
    expect(links.map((l) => l.label)).toEqual([
      "Legal Documents",
      "Terms of Use",
      "PDPA",
      "Risk Statement",
    ]);
  });
});
