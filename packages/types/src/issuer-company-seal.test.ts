import {
  issuerCompanySealS3Prefix,
  isIssuerCompanySealS3Key,
  parseIssuerOrganizationIdFromCompanySealKey,
} from "./issuer-company-seal";

describe("issuer company seal S3 keys", () => {
  it("scopes keys to the organisation", () => {
    const prefix = issuerCompanySealS3Prefix("org_1");
    expect(prefix).toBe("issuer-organizations/org_1/company-seals/");
    expect(isIssuerCompanySealS3Key("org_1", `${prefix}v1-a.png`)).toBe(true);
    expect(isIssuerCompanySealS3Key("org_1", prefix)).toBe(false);
    expect(isIssuerCompanySealS3Key("org_1", `${prefix}../other.png`)).toBe(false);
    expect(isIssuerCompanySealS3Key("org_2", `${prefix}v1-a.png`)).toBe(false);
    expect(parseIssuerOrganizationIdFromCompanySealKey(`${prefix}v1-a.png`)).toBe("org_1");
    expect(parseIssuerOrganizationIdFromCompanySealKey("products/foo.png")).toBeNull();
  });
});
