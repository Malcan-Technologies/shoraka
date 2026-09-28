import { resolvePreviousYearSourceValue } from "./financial-previous-year-source";

describe("resolvePreviousYearSourceValue", () => {
  it("Scenario A: User Input current FY falls back to previous User Input", () => {
    expect(
      resolvePreviousYearSourceValue({
        currentSource: "user_input",
        previousUserInputValue: 123,
        previousCtosValue: 456,
        previousActiveAdminInputValue: 789,
      })
    ).toBe(123);
  });

  it("Scenario B: User Input current FY falls back to previous CTOS when prior User Input missing", () => {
    expect(
      resolvePreviousYearSourceValue({
        currentSource: "user_input",
        previousUserInputValue: null,
        previousCtosValue: 456,
        previousActiveAdminInputValue: 789,
      })
    ).toBe(456);
  });

  it("Scenario C: User Input current FY falls back to active Admin Input when prior User Input and CTOS missing", () => {
    expect(
      resolvePreviousYearSourceValue({
        currentSource: "user_input",
        previousUserInputValue: null,
        previousCtosValue: null,
        previousActiveAdminInputValue: 789,
      })
    ).toBe(789);
  });

  it("Scenario D: User Input current FY cannot calculate when no previous source exists", () => {
    expect(
      resolvePreviousYearSourceValue({
        currentSource: "user_input",
        previousUserInputValue: null,
        previousCtosValue: null,
        previousActiveAdminInputValue: null,
      })
    ).toBeNull();
  });

  it("Scenario E: CTOS current FY never uses User Input as historical fallback", () => {
    expect(
      resolvePreviousYearSourceValue({
        currentSource: "ctos",
        previousUserInputValue: 123,
        previousCtosValue: 456,
        previousActiveAdminInputValue: 789,
      })
    ).toBe(456);
  });

  it("Scenario F: CTOS current FY falls back to active Admin Input when prior CTOS missing", () => {
    expect(
      resolvePreviousYearSourceValue({
        currentSource: "ctos",
        previousUserInputValue: 123,
        previousCtosValue: null,
        previousActiveAdminInputValue: 789,
      })
    ).toBe(789);
  });

  it("Scenario G: Admin Input current FY uses previous CTOS when present", () => {
    expect(
      resolvePreviousYearSourceValue({
        currentSource: "admin_input",
        previousUserInputValue: 123,
        previousCtosValue: 456,
        previousActiveAdminInputValue: 789,
      })
    ).toBe(456);
  });

  it("Scenario H: Admin Input current FY uses active Admin Input when prior CTOS missing", () => {
    expect(
      resolvePreviousYearSourceValue({
        currentSource: "admin_input",
        previousUserInputValue: 123,
        previousCtosValue: null,
        previousActiveAdminInputValue: 789,
      })
    ).toBe(789);
  });

  it("Scenario I: Superseded Admin Input is excluded (active admin value missing) and CTOS is used", () => {
    // Old Admin Input exists historically, but it is superseded by a later CTOS refresh.
    // The active admin input value is therefore null here.
    expect(
      resolvePreviousYearSourceValue({
        currentSource: "user_input",
        previousUserInputValue: null,
        previousCtosValue: 456,
        previousActiveAdminInputValue: null,
      })
    ).toBe(456);
  });

  it("Scenario J: 0 counts as a real value and stops fallback", () => {
    expect(
      resolvePreviousYearSourceValue({
        currentSource: "user_input",
        previousUserInputValue: 0,
        previousCtosValue: 456,
        previousActiveAdminInputValue: 789,
      })
    ).toBe(0);
  });
});

