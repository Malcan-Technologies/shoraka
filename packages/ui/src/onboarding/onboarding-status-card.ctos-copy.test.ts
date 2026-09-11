import { readFileSync } from "fs";
import { join } from "path";

describe("onboarding status card empty-people copy", () => {
  const source = readFileSync(join(__dirname, "onboarding-status-card.tsx"), "utf8");

  it("uses customer-safe copy when directors/shareholders are missing from company information", () => {
    expect(source).toContain("CUSTOMER_DIRECTOR_SHAREHOLDER_EMPTY_STATE");
    expect(source).toContain("resolveCustomerDirectorShareholderEmptyWarning");
    expect(source).toContain("people: orgWithPeople.people ?? []");
    expect(source).not.toContain("latest CTOS information");
    expect(source).not.toContain("resolveDirectorShareholderCtosEmptyWarning");
  });
});
