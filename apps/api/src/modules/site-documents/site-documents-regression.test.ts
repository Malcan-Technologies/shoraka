import { createDocumentSchema, siteDocumentTypes } from "../site-documents/schemas";

describe("SiteDocument origin/main compatibility", () => {
  it("accepts origin/main create payloads without legal fields", () => {
    const parsed = createDocumentSchema.parse({
      type: "PRIVACY_POLICY",
      title: "Privacy Policy",
      fileName: "privacy.pdf",
      s3Key: "site-documents/privacy.pdf",
      contentType: "application/pdf",
      fileSize: 2048,
      showInAccount: true,
    });

    expect(parsed.type).toBe("PRIVACY_POLICY");
    expect(parsed.showInAccount).toBe(true);
    expect(parsed).not.toHaveProperty("acceptanceRequired");
    expect(parsed).not.toHaveProperty("audience");
  });

  it("supports existing generic document types only", () => {
    expect(siteDocumentTypes).toEqual([
      "TERMS_AND_CONDITIONS",
      "PRIVACY_POLICY",
      "RISK_DISCLOSURE",
      "PLATFORM_AGREEMENT",
      "INVESTOR_GUIDE",
      "ISSUER_GUIDE",
      "OTHER",
    ]);
    expect(siteDocumentTypes).not.toContain("PDPA_NOTICE_AND_CONSENT");
    expect(siteDocumentTypes).not.toContain("RISK_STATEMENT");
    expect(siteDocumentTypes).not.toContain("PDPA_NOTICE");
  });

  it("keeps RISK_DISCLOSURE as a SiteDocument type, not a legal type", () => {
    expect(siteDocumentTypes).toContain("RISK_DISCLOSURE");
    const parsed = createDocumentSchema.parse({
      type: "RISK_DISCLOSURE",
      title: "Risk Disclosure",
      fileName: "risk.pdf",
      s3Key: "site-documents/risk.pdf",
      contentType: "application/pdf",
      fileSize: 100,
    });
    expect(parsed.type).toBe("RISK_DISCLOSURE");
  });
});
