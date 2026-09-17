import {
  canManageIssuerCompanySeal,
  COMPANY_SEAL_MANAGE_FORBIDDEN_MESSAGE,
  ISSUER_COMPANY_SEAL_OWNER_ADMIN_REQUIRED_MESSAGE,
  ISSUER_COMPANY_SEAL_REQUIRED_MESSAGE,
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

  it("restricts seal management to the organisation owner or an organisation admin", () => {
    expect(canManageIssuerCompanySeal({ isOwner: true, members: [] }, "user_1")).toBe(true);
    expect(
      canManageIssuerCompanySeal(
        {
          isOwner: false,
          members: [{ id: "user_1", role: "ORGANIZATION_ADMIN" }],
        },
        "user_1"
      )
    ).toBe(true);
    expect(
      canManageIssuerCompanySeal(
        {
          isOwner: false,
          members: [{ id: "user_1", role: "ORGANIZATION_MEMBER" }],
        },
        "user_1"
      )
    ).toBe(false);
    expect(canManageIssuerCompanySeal({ isOwner: false, members: [] }, null)).toBe(false);
    expect(ISSUER_COMPANY_SEAL_REQUIRED_MESSAGE).toContain("Organisation");
    expect(ISSUER_COMPANY_SEAL_OWNER_ADMIN_REQUIRED_MESSAGE).toContain("owner or admin");
    expect(COMPANY_SEAL_MANAGE_FORBIDDEN_MESSAGE).toContain("organisation admin");
  });
});
