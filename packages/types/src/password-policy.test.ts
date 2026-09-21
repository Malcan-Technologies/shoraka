import {
  PASSWORD_POLICY_MESSAGE,
  isCommonPassword,
  meetsPasswordPolicy,
  passwordPolicyIssue,
} from "./password-policy";

describe("password policy", () => {
  it("accepts mixed-case passwords with a digit and Cognito-supported symbol", () => {
    expect(meetsPasswordPolicy("Tr0ub4dor&3")).toBe(true);
    expect(meetsPasswordPolicy("GoodPass1!")).toBe(true);
    expect(passwordPolicyIssue("Tr0ub4dor&3")).toBeNull();
  });

  it("does not treat whitespace as the required Cognito symbol", () => {
    expect(meetsPasswordPolicy("Password1 x")).toBe(false);
    expect(meetsPasswordPolicy("GoodPass1 ")).toBe(false);
    expect(meetsPasswordPolicy("Good Pass1")).toBe(false);
    expect(meetsPasswordPolicy("Good Pass1!")).toBe(true);
  });

  it("rejects short, incomplete, and common passwords with one message", () => {
    expect(meetsPasswordPolicy("Short1!")).toBe(false);
    expect(meetsPasswordPolicy("NoDigit!!")).toBe(false);
    expect(meetsPasswordPolicy("nodigit1!")).toBe(false);
    expect(meetsPasswordPolicy("NOLOWER1!")).toBe(false);
    expect(meetsPasswordPolicy("NoSymbol1")).toBe(false);
    expect(isCommonPassword("Password1!")).toBe(true);
    expect(meetsPasswordPolicy("Password1!")).toBe(false);
    expect(passwordPolicyIssue("Password1!")).toBe(PASSWORD_POLICY_MESSAGE);
  });
});
