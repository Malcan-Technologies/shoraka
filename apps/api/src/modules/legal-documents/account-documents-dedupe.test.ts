import {
  filterSiteDocumentsSupersededByLegal,
  legalTypeSupersedingSiteDocumentType,
  SITE_DOCUMENT_TYPE_SUPERSEDED_BY_LEGAL,
} from "@cashsouk/types";

describe("account document SiteDocument / LegalDocument dedupe", () => {
  it("maps stable site types to legal types without using titles", () => {
    expect(SITE_DOCUMENT_TYPE_SUPERSEDED_BY_LEGAL.TERMS_AND_CONDITIONS).toBe(
      "TERMS_OF_USE"
    );
    expect(SITE_DOCUMENT_TYPE_SUPERSEDED_BY_LEGAL.PRIVACY_POLICY).toBe(
      "PDPA_NOTICE_AND_CONSENT"
    );
    expect(SITE_DOCUMENT_TYPE_SUPERSEDED_BY_LEGAL.RISK_DISCLOSURE).toBe(
      "RISK_STATEMENT"
    );
    expect(legalTypeSupersedingSiteDocumentType("INVESTOR_GUIDE")).toBeNull();
    expect(legalTypeSupersedingSiteDocumentType("PLATFORM_AGREEMENT")).toBeNull();
  });

  it("hides superseded site documents when the mapped legal type is present", () => {
    const site = [
      { id: "s1", type: "TERMS_AND_CONDITIONS", title: "Anything" },
      { id: "s2", type: "INVESTOR_GUIDE", title: "Guide" },
      { id: "s3", type: "PRIVACY_POLICY", title: "Privacy" },
    ];
    const filtered = filterSiteDocumentsSupersededByLegal(site, [
      "TERMS_OF_USE",
      "RISK_STATEMENT",
    ]);
    expect(filtered.map((d) => d.id)).toEqual(["s2", "s3"]);
  });

  it("keeps site documents when no matching legal type is shown", () => {
    const site = [{ id: "s1", type: "TERMS_AND_CONDITIONS", title: "Terms of Use" }];
    expect(filterSiteDocumentsSupersededByLegal(site, ["ISSUER_AGREEMENT"])).toEqual(
      site
    );
  });
});
