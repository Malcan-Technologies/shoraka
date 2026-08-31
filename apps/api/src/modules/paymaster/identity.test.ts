import {
  parseRegistrationLookup,
  parseRelatedPartyFlag,
  parseSubmittedIdentity,
} from "./identity";

describe("Paymaster identity helpers", () => {
  it("normalizes 12-digit Malaysian registration numbers only", () => {
    expect(parseRegistrationLookup("2021-3456-7890")).toBe("202134567890");
    expect(parseRegistrationLookup("123")).toBeNull();
    expect(parseRegistrationLookup("ABC Trading")).toBeNull();
  });

  it("does not treat unanswered related-party as false", () => {
    expect(parseRelatedPartyFlag(undefined)).toBeNull();
    expect(parseRelatedPartyFlag("no")).toBeNull();
    expect(parseRelatedPartyFlag(true)).toBe(true);
    expect(parseRelatedPartyFlag(false)).toBe(false);
  });

  it("parses submitted identity by registration, never by name", () => {
    const parsed = parseSubmittedIdentity({
      name: " ABC Trading Sdn Bhd ",
      ssm_number: "202134567890",
      country: "my",
      entity_type: "Private Limited Company (Sdn Bhd)",
    });
    expect(parsed?.registrationNumber).toBe("202134567890");
    expect(parsed?.legalName).toBe("ABC Trading Sdn Bhd");
    expect(parseSubmittedIdentity({ name: "ABC Trading Sdn Bhd" })).toBeNull();
  });
});
