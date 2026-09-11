import {
  CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING,
  CUSTOMER_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING,
  CUSTOMER_DIRECTOR_SHAREHOLDER_EMPTY_STATE,
  relatedPartyVerificationCaption,
  resolveCustomerDirectorShareholderEmptyWarning,
  resolveDirectorShareholderCtosEmptyWarning,
  type PeopleRolesRowInput,
} from "./application-people-display";

const CTOS_EMPTY_INPUT = {
  directorShareholderListSource: "CTOS_EMPTY" as const,
  ctosDirectorShareholderWarning: CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING,
};

function person(overrides: Partial<PeopleRolesRowInput> & Pick<PeopleRolesRowInput, "roles">): PeopleRolesRowInput {
  return {
    sharePercentage: null,
    ...overrides,
  };
}

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
    expect(resolveCustomerDirectorShareholderEmptyWarning({ ...CTOS_EMPTY_INPUT, people: [] })).toBe(
      CUSTOMER_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING
    );
    expect(
      resolveCustomerDirectorShareholderEmptyWarning({
        directorShareholderListSource: "ONBOARDING",
        ctosDirectorShareholderWarning: null,
        people: [],
      })
    ).toBeNull();
  });

  it("labels individuals as KYC and corporates as KYB", () => {
    expect(relatedPartyVerificationCaption("INDIVIDUAL")).toBe("Individual · KYC");
    expect(relatedPartyVerificationCaption("CORPORATE")).toBe("Company · KYB");
  });
});

describe("resolveCustomerDirectorShareholderEmptyWarning", () => {
  it("does not warn when CTOS returned directors or shareholders", () => {
    expect(
      resolveCustomerDirectorShareholderEmptyWarning({
        directorShareholderListSource: "CTOS",
        ctosDirectorShareholderWarning: null,
        people: [person({ roles: ["DIRECTOR"] })],
      })
    ).toBeNull();
  });

  it("does not warn when CTOS is empty but RegTank fallback has a director", () => {
    expect(
      resolveCustomerDirectorShareholderEmptyWarning({
        ...CTOS_EMPTY_INPUT,
        people: [person({ roles: ["DIRECTOR"] })],
      })
    ).toBeNull();
  });

  it("does not warn when CTOS is empty but RegTank fallback has a shareholder", () => {
    expect(
      resolveCustomerDirectorShareholderEmptyWarning({
        ...CTOS_EMPTY_INPUT,
        people: [person({ roles: ["SHAREHOLDER"], sharePercentage: 100 })],
      })
    ).toBeNull();
  });

  it("does not warn when CTOS is empty and the same fallback person is director and shareholder", () => {
    expect(
      resolveCustomerDirectorShareholderEmptyWarning({
        ...CTOS_EMPTY_INPUT,
        people: [person({ roles: ["DIRECTOR", "SHAREHOLDER"], sharePercentage: 100 })],
      })
    ).toBeNull();
  });

  it("does not warn when CTOS is empty and a master party director/shareholder is in people[]", () => {
    expect(
      resolveCustomerDirectorShareholderEmptyWarning({
        ...CTOS_EMPTY_INPUT,
        people: [person({ roles: ["DIRECTOR", "SHAREHOLDER"], sharePercentage: 40 })],
      })
    ).toBeNull();
  });

  it("warns when CTOS is empty and there is no usable fallback or master person", () => {
    expect(resolveCustomerDirectorShareholderEmptyWarning({ ...CTOS_EMPTY_INPUT, people: [] })).toBe(
      CUSTOMER_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING
    );
    expect(
      resolveCustomerDirectorShareholderEmptyWarning({
        ...CTOS_EMPTY_INPUT,
        people: [person({ roles: ["MANAGEMENT"] })],
      })
    ).toBe(CUSTOMER_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING);
  });

  it("does not count inactive or below-threshold fallback people as usable", () => {
    expect(
      resolveCustomerDirectorShareholderEmptyWarning({
        ...CTOS_EMPTY_INPUT,
        people: [person({ roles: ["SHAREHOLDER"], sharePercentage: 3 })],
      })
    ).toBe(CUSTOMER_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING);
    expect(
      resolveCustomerDirectorShareholderEmptyWarning({
        ...CTOS_EMPTY_INPUT,
        people: [person({ roles: ["DIRECTOR", "SHAREHOLDER"], sharePercentage: 3 })],
      })
    ).toBeNull();
  });

  it("keeps Admin CTOS empty copy independent of fallback people", () => {
    expect(
      resolveDirectorShareholderCtosEmptyWarning({
        directorShareholderListSource: "CTOS_EMPTY",
        ctosDirectorShareholderWarning: CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING,
      })
    ).toBe(CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING);
    expect(CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING).toContain("CTOS");
  });
});
