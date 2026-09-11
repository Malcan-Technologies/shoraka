import {
  CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING,
  CUSTOMER_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING,
  CUSTOMER_DIRECTOR_SHAREHOLDER_EMPTY_STATE,
  relatedPartyVerificationCaption,
  resolveCustomerDirectorShareholderEmptyWarning,
  resolveDirectorShareholderCtosEmptyWarning,
} from "./application-people-display";

describe("CTOS empty-people copy", () => {
  it("names CTOS when the empty director/shareholder warning is from CTOS", () => {
    expect(CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING).toContain("did not return usable");
    expect(CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING).toContain("CTOS");
    expect(CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING).not.toContain("external information");
    expect(
      resolveDirectorShareholderCtosEmptyWarning({ directorShareholderListSource: "CTOS_EMPTY" })
    ).toBe(CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING);
  });

  it("uses provider-neutral copy for issuer and investor portals", () => {
    expect(CUSTOMER_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING).not.toMatch(/CTOS/i);
    expect(CUSTOMER_DIRECTOR_SHAREHOLDER_EMPTY_STATE).not.toMatch(/CTOS/i);
    expect(CUSTOMER_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING).toContain(
      "No directors or shareholders were found in the company information"
    );
    expect(
      resolveCustomerDirectorShareholderEmptyWarning({
        directorShareholderListSource: "CTOS_EMPTY",
        ctosDirectorShareholderWarning: CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING,
      })
    ).toBe(CUSTOMER_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING);
    expect(
      resolveCustomerDirectorShareholderEmptyWarning({
        directorShareholderListSource: "ONBOARDING",
        ctosDirectorShareholderWarning: null,
      })
    ).toBeNull();
  });

  it("labels individuals as KYC and corporates as KYB", () => {
    expect(relatedPartyVerificationCaption("INDIVIDUAL")).toBe("Individual · KYC");
    expect(relatedPartyVerificationCaption("CORPORATE")).toBe("Company · KYB");
  });
});
